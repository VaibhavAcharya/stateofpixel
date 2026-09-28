import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  blobDeleteUrl,
  blobImageUrl,
  blobUploadUrl,
  privateImageUrl,
  verifyStored,
} from "./lib/imageUrls";
import {
  MAX_BLOB_IMAGE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
} from "./lib/limits";
import { withStorageBytes } from "./lib/storage";
import { rateLimiter } from "./rateLimits";

const TOUCH_AFTER_MS = 12 * 60 * 60 * 1000;
const BLOB_RECEIPT = /^blob\.([0-9a-f-]{36})\.(\d+)\.([A-Za-z0-9_-]{43})$/;

export const createUploadTargets = internalMutation({
  args: {
    accountId: v.id("accounts"),
    storageBlocked: v.boolean(),
    hashes: v.array(v.string()),
  },
  returns: v.array(v.object({ hash: v.string(), uploadUrl: v.string() })),
  handler: async (ctx, { accountId, storageBlocked, hashes }) => {
    const targets = [];
    const now = Date.now();
    const account = await ctx.db.get("accounts", accountId);
    for (const hash of new Set(hashes)) {
      const image = await findImage(ctx, accountId, hash);
      if (image === null) {
        if (storageBlocked) {
          continue;
        }
        targets.push({
          hash,
          uploadUrl:
            account?.imageStore === "blobs"
              ? await blobUploadUrl(
                  `${accountId}/${crypto.randomUUID()}`,
                  hash,
                  now,
                )
              : await ctx.storage.generateUploadUrl(),
        });
      } else if (now - image.lastReferencedAt > TOUCH_AFTER_MS) {
        await ctx.db.patch("images", image._id, { lastReferencedAt: now });
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
  return ctx.db
    .query("images")
    .withIndex("by_accountId_and_hash", (q) =>
      q.eq("accountId", accountId).eq("hash", hash),
    )
    .first();
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
  if (receipt !== null) {
    return confirmBlobUpload(ctx, accountId, upload, receipt);
  }
  const storageId = ctx.db.system.normalizeId("_storage", upload.storageId);
  if (storageId === null) {
    return null;
  }
  const referenced = await ctx.db
    .query("images")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  if (referenced !== null) {
    return referenced.accountId === accountId && referenced.hash === upload.hash
      ? referenced
      : null;
  }

  const file = await ctx.db.system.get("_storage", storageId);
  if (file === null) {
    return null;
  }
  if (
    normalizeSha256(file.sha256) !== upload.hash.toLowerCase() ||
    file.size > MAX_IMAGE_BYTES ||
    upload.width > MAX_IMAGE_WIDTH ||
    upload.height > MAX_IMAGE_HEIGHT
  ) {
    await ctx.storage.delete(storageId);
    return null;
  }

  const existing = await findImage(ctx, accountId, upload.hash);
  if (existing !== null) {
    await ctx.storage.delete(storageId);
    return existing;
  }
  return insertImage(
    ctx,
    accountId,
    upload,
    { store: "convex", storageId },
    file.size,
  );
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
    bytes > MAX_BLOB_IMAGE_BYTES ||
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
  return insertImage(
    ctx,
    accountId,
    upload,
    { store: "blobs", blobKey },
    bytes,
  );
}

async function insertImage(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
  location:
    | { store: "convex"; storageId: Id<"_storage"> }
    | { store: "blobs"; blobKey: string },
  bytes: number,
): Promise<Doc<"images"> | null> {
  const imageId = await ctx.db.insert("images", {
    accountId,
    hash: upload.hash.toLowerCase(),
    kind: upload.kind,
    bytes,
    width: upload.width,
    height: upload.height,
    ...location,
    lastReferencedAt: Date.now(),
  });
  await rateLimiter.limit(ctx, "uploadedBytes", {
    key: accountId,
    count: bytes,
    reserve: true,
  });
  const account = await ctx.db.get("accounts", accountId);
  if (account !== null) {
    await ctx.db.patch(
      "accounts",
      accountId,
      withStorageBytes(account, account.storageBytes + bytes, Date.now()),
    );
  }
  return ctx.db.get("images", imageId);
}

export async function getUrl(
  ctx: QueryCtx,
  image: Doc<"images">,
  project: Doc<"projects">,
): Promise<string | null> {
  if (image.blobKey !== undefined) {
    return blobImageUrl(project, image.blobKey);
  }
  if (image.storageId === undefined) {
    return null;
  }
  return project.private
    ? privateImageUrl(project._id, image._id)
    : ctx.storage.getUrl(image.storageId);
}

export function readImage(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
): Promise<Blob | null> {
  return ctx.storage.get(storageId);
}

function normalizeSha256(value: string): string | null {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return value.toLowerCase();
  }
  try {
    return [...atob(value.replace(/-/g, "+").replace(/_/g, "/"))]
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export async function deleteImage(ctx: MutationCtx, image: Doc<"images">) {
  if (image.storageId !== undefined) {
    await ctx.storage.delete(image.storageId);
  }
  if (image.blobKey !== undefined) {
    await scheduleBlobDelete(ctx, image.blobKey);
  }
  await ctx.db.delete("images", image._id);
}

function scheduleBlobDelete(ctx: MutationCtx, blobKey: string) {
  return ctx.scheduler.runAfter(0, internal.blobs.deleteBlob, { blobKey });
}

export const deleteBlob = internalAction({
  args: { blobKey: v.string() },
  returns: v.null(),
  handler: async (_ctx, { blobKey }) => {
    const response = await fetch(await blobDeleteUrl(blobKey, Date.now()), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Deleting blob ${blobKey} failed: ${response.status}`);
    }
    return null;
  },
});
