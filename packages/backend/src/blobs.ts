import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import { imageStore } from "./lib/imageStore.ts";
import { blobImageUrl, blobUploadUrl, verifyStored } from "./lib/imageUrls.ts";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
} from "./lib/limits.ts";
import { withStorageBytes } from "./lib/storage.ts";
import { rateLimiter } from "./rateLimits.ts";
import { accounts, images } from "./schema.ts";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./server.ts";

const TOUCH_AFTER_MS = 12 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DELETE_RETRY_DELAYS_MS = [
  MINUTE_MS,
  10 * MINUTE_MS,
  60 * MINUTE_MS,
  6 * 60 * MINUTE_MS,
  24 * 60 * MINUTE_MS,
];
const BLOB_RECEIPT = /^blob\.([0-9a-f-]{36})\.(\d+)\.([A-Za-z0-9_-]{43})$/;

export const createUploadTargets = internalMutation({
  args: {
    accountId: z.string(),
    storageBlocked: z.boolean(),
    hashes: z.array(z.string()),
  },
  handler: async (ctx, { accountId, storageBlocked, hashes }) => {
    const targets = [];
    const now = Date.now();
    for (const hash of new Set(hashes)) {
      const image = await findImage(ctx, accountId, hash);
      if (image === null) {
        if (storageBlocked) {
          continue;
        }
        targets.push({
          hash,
          uploadUrl: await blobUploadUrl(
            `${accountId}/${crypto.randomUUID()}`,
            hash,
            now,
          ),
        });
      } else if (now - image.lastReferencedAt > TOUCH_AFTER_MS) {
        await ctx.db
          .update(images)
          .set({ lastReferencedAt: now })
          .where(eq(images._id, image._id));
      }
    }
    return targets;
  },
});

export async function findImage(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  hash: string,
): Promise<Doc<"images"> | null> {
  return first(
    await ctx.db
      .select()
      .from(images)
      .where(and(eq(images.accountId, accountId), eq(images.hash, hash)))
      .orderBy(asc(images._creationTime), asc(images._id))
      .limit(1),
  );
}

export type Upload = {
  hash: string;
  storageId: string;
  kind: "screenshot" | "diff";
  width: number;
  height: number;
};

export async function confirmUpload(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
): Promise<Doc<"images"> | null> {
  const receipt = BLOB_RECEIPT.exec(upload.storageId);
  if (receipt === null) {
    return null;
  }
  return confirmBlobUpload(ctx, accountId, upload, receipt);
}

async function confirmBlobUpload(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
  [, uploadId, bytesText, sig]: RegExpExecArray,
): Promise<Doc<"images"> | null> {
  const blobKey = `${accountId}/${uploadId}`;
  const hash = upload.hash.toLowerCase();
  const bytes = Number(bytesText);
  if (!(await verifyStored(blobKey, hash, bytes, sig ?? ""))) {
    return null;
  }
  if (
    bytes > MAX_IMAGE_BYTES ||
    upload.width > MAX_IMAGE_WIDTH ||
    upload.height > MAX_IMAGE_HEIGHT
  ) {
    await scheduleBlobDelete(ctx, blobKey);
    return null;
  }

  const existing = await findImage(ctx, accountId, hash);
  if (existing !== null) {
    if (existing.blobKey !== blobKey) {
      await scheduleBlobDelete(ctx, blobKey);
    }
    return existing;
  }
  return insertImage(ctx, accountId, upload, blobKey, bytes);
}

async function insertImage(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
  blobKey: string,
  bytes: number,
): Promise<Doc<"images"> | null> {
  const image = one(
    await ctx.db
      .insert(images)
      .values({
        accountId,
        hash: upload.hash.toLowerCase(),
        kind: upload.kind,
        bytes,
        width: upload.width,
        height: upload.height,
        blobKey,
        lastReferencedAt: Date.now(),
      })
      .returning(),
  );
  await rateLimiter.limit(ctx, "uploadedBytes", {
    key: accountId,
    count: bytes,
    reserve: true,
  });
  const account = first(
    await ctx.db.select().from(accounts).where(eq(accounts._id, accountId)),
  );
  if (account !== null) {
    await ctx.db
      .update(accounts)
      .set(withStorageBytes(account, account.storageBytes + bytes, Date.now()))
      .where(eq(accounts._id, accountId));
  }
  return image;
}

export async function getUrl(
  _ctx: QueryCtx,
  image: Doc<"images">,
  project: Doc<"projects">,
): Promise<string | null> {
  return blobImageUrl(project, image.blobKey);
}

export async function deleteImage(ctx: MutationCtx, image: Doc<"images">) {
  await scheduleBlobDelete(ctx, image.blobKey);
  await ctx.db.delete(images).where(eq(images._id, image._id));
}

function scheduleBlobDelete(ctx: MutationCtx, blobKey: string) {
  return ctx.scheduler.runAfter(0, internal.blobs.deleteBlob, { blobKey });
}

export const deleteBlob = internalAction({
  args: { blobKey: z.string(), attempt: z.number().optional() },
  handler: async (ctx, { blobKey, attempt = 0 }) => {
    const error = await imageStore()
      .delete(blobKey)
      .then(
        () => null,
        (error: unknown) => error,
      );
    if (error === null) {
      return null;
    }
    const delay = DELETE_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      throw new Error(`Deleting blob ${blobKey} failed: ${String(error)}`);
    }
    await ctx.scheduler.runAfter(delay, internal.blobs.deleteBlob, {
      blobKey,
      attempt: attempt + 1,
    });
    return null;
  },
});
