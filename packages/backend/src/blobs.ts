import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
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
  internalQuery,
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
const ORPHAN_GRACE_MS = 24 * 60 * MINUTE_MS;
const UUID_V7 =
  /^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BLOB_RECEIPT = /^blob\.([0-9a-f-]{36})\.(\d+)\.([A-Za-z0-9_-]{43})$/;

export const createUploadTargets = internalMutation({
  args: {
    accountId: z.string(),
    storageBlocked: z.boolean(),
    hashes: z.array(z.string()),
  },
  handler: async (ctx, { accountId, storageBlocked, hashes }) => {
    const targets = [];
    const staleImageIds = [];
    const now = Date.now();
    const existing = await findImages(ctx, accountId, hashes);
    for (const hash of new Set(hashes)) {
      const image = existing.get(hash);
      if (image === undefined) {
        if (storageBlocked) {
          continue;
        }
        targets.push({
          hash,
          uploadUrl: await blobUploadUrl(
            `${accountId}/${newUploadId(now)}`,
            hash,
            now,
          ),
        });
      } else if (now - image.lastReferencedAt > TOUCH_AFTER_MS) {
        staleImageIds.push(image._id);
      }
    }
    if (staleImageIds.length > 0) {
      await ctx.db
        .update(images)
        .set({ lastReferencedAt: now })
        .where(inArray(images._id, staleImageIds));
    }
    return targets;
  },
});

export async function findImages(
  ctx: QueryCtx,
  accountId: Id<"accounts">,
  hashes: string[],
): Promise<Map<string, Doc<"images">>> {
  const found = new Map<string, Doc<"images">>();
  if (hashes.length === 0) {
    return found;
  }
  const rows = await ctx.db
    .select()
    .from(images)
    .where(
      and(
        eq(images.accountId, accountId),
        inArray(images.hash, [...new Set(hashes)]),
      ),
    )
    .orderBy(asc(images._creationTime), asc(images._id));
  for (const row of rows) {
    if (!found.has(row.hash)) {
      found.set(row.hash, row);
    }
  }
  return found;
}

export type Upload = {
  hash: string;
  storageId: string;
  kind: "screenshot" | "diff";
  width: number;
  height: number;
};

export async function confirmUploadedImages(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  uploads: Upload[],
): Promise<{ hash: string; confirmed: boolean }[]> {
  const existing = await findImages(
    ctx,
    accountId,
    uploads.map((upload) => upload.hash.toLowerCase()),
  );
  const results = [];
  const inserts: (typeof images.$inferInsert)[] = [];
  for (const upload of uploads) {
    const receipt = BLOB_RECEIPT.exec(upload.storageId);
    const confirmed =
      receipt !== null &&
      (await confirmBlobUpload(
        ctx,
        accountId,
        upload,
        receipt,
        existing,
        inserts,
      ));
    results.push({ hash: upload.hash, confirmed });
  }
  if (inserts.length > 0) {
    await insertImages(ctx, accountId, inserts);
  }
  return results;
}

async function confirmBlobUpload(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
  [, uploadId, bytesText, sig]: RegExpExecArray,
  existing: Map<string, { blobKey: string }>,
  inserts: (typeof images.$inferInsert)[],
): Promise<boolean> {
  const blobKey = `${accountId}/${uploadId}`;
  const hash = upload.hash.toLowerCase();
  const bytes = Number(bytesText);
  if (!(await verifyStored(blobKey, hash, bytes, sig ?? ""))) {
    return false;
  }
  if (
    bytes > MAX_IMAGE_BYTES ||
    upload.width > MAX_IMAGE_WIDTH ||
    upload.height > MAX_IMAGE_HEIGHT
  ) {
    await scheduleBlobDelete(ctx, blobKey);
    return false;
  }

  const image = existing.get(hash);
  if (image !== undefined) {
    if (image.blobKey !== blobKey) {
      await scheduleBlobDelete(ctx, blobKey);
    }
    return true;
  }
  const insert = {
    accountId,
    hash,
    kind: upload.kind,
    bytes,
    width: upload.width,
    height: upload.height,
    blobKey,
    lastReferencedAt: Date.now(),
  };
  existing.set(hash, insert);
  inserts.push(insert);
  return true;
}

async function insertImages(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  inserts: (typeof images.$inferInsert)[],
) {
  await ctx.db.insert(images).values(inserts);
  const bytes = inserts.reduce((total, image) => total + image.bytes, 0);
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
}

export async function getUrl(
  _ctx: QueryCtx,
  image: Doc<"images">,
  project: Doc<"projects">,
): Promise<string | null> {
  return blobImageUrl(project, image.blobKey, image.bytes);
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

export const sweepOrphanBlobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const store = imageStore();
    for await (const page of store.list({ paginate: true })) {
      const candidates = page.blobs
        .map((blob) => blob.key)
        .filter((blobKey) => (uploadTime(blobKey) ?? 0) < cutoff);
      if (candidates.length === 0) {
        continue;
      }
      const known = new Set(
        await ctx.runQuery(internal.blobs.knownBlobKeys, {
          blobKeys: candidates,
        }),
      );
      for (const blobKey of candidates) {
        if (!known.has(blobKey)) {
          await store.delete(blobKey);
        }
      }
    }
    return null;
  },
});

export const knownBlobKeys = internalQuery({
  args: { blobKeys: z.array(z.string()) },
  handler: async (ctx, { blobKeys }) => {
    const rows = await ctx.db
      .select({ blobKey: images.blobKey })
      .from(images)
      .where(inArray(images.blobKey, blobKeys));
    return rows.map((row) => row.blobKey);
  },
});

export function newUploadId(now: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = now;
  for (let index = 5; index >= 0; index--) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10),
  ]
    .map((part) => part.join(""))
    .join("-");
}

function uploadTime(blobKey: string): number | null {
  const match = UUID_V7.exec(blobKey.split("/")[1] ?? "");
  if (match === null) {
    return null;
  }
  return Number.parseInt(`${match[1]}${match[2]}`, 16);
}
