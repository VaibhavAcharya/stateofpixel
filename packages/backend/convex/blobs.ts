import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { withStorageBytes } from "./lib/storage";
import { rateLimiter } from "./rateLimits";

const TOUCH_AFTER_MS = 12 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 10_000;
const MAX_IMAGE_HEIGHT = 50_000;

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
    for (const hash of new Set(hashes)) {
      const image = await findImage(ctx, accountId, hash);
      if (image === null) {
        if (storageBlocked) {
          continue;
        }
        targets.push({
          hash,
          uploadUrl: await ctx.storage.generateUploadUrl(),
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
  storageId: Id<"_storage">;
  kind: "screenshot" | "diff";
  width: number;
  height: number;
};

export async function confirmUpload(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
): Promise<Doc<"images"> | null> {
  const referenced = await ctx.db
    .query("images")
    .withIndex("by_storageId", (q) => q.eq("storageId", upload.storageId))
    .first();
  if (referenced !== null) {
    return referenced.accountId === accountId && referenced.hash === upload.hash
      ? referenced
      : null;
  }

  const file = await ctx.db.system.get("_storage", upload.storageId);
  if (file === null) {
    return null;
  }
  if (
    normalizeSha256(file.sha256) !== upload.hash.toLowerCase() ||
    file.size > MAX_IMAGE_BYTES ||
    upload.width > MAX_IMAGE_WIDTH ||
    upload.height > MAX_IMAGE_HEIGHT
  ) {
    await ctx.storage.delete(upload.storageId);
    return null;
  }

  const existing = await findImage(ctx, accountId, upload.hash);
  if (existing !== null) {
    await ctx.storage.delete(upload.storageId);
    return existing;
  }
  const imageId = await ctx.db.insert("images", {
    accountId,
    hash: upload.hash.toLowerCase(),
    kind: upload.kind,
    bytes: file.size,
    width: upload.width,
    height: upload.height,
    store: "convex",
    storageId: upload.storageId,
    lastReferencedAt: Date.now(),
  });
  await rateLimiter.limit(ctx, "uploadedBytes", {
    key: accountId,
    count: file.size,
    reserve: true,
  });
  const account = await ctx.db.get("accounts", accountId);
  if (account !== null) {
    await ctx.db.patch(
      "accounts",
      accountId,
      withStorageBytes(account, account.storageBytes + file.size, Date.now()),
    );
  }
  return ctx.db.get("images", imageId);
}

export async function getUrl(
  ctx: QueryCtx,
  image: Doc<"images">,
): Promise<string | null> {
  return image.storageId === undefined
    ? null
    : ctx.storage.getUrl(image.storageId);
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
  await ctx.db.delete("images", image._id);
}
