import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  env,
  internalAction,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { privateImageUrl, r2ImageUrl } from "./lib/imageUrls";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
} from "./lib/limits";
import {
  messages,
  R2_RECEIPT_PREFIX,
  r2Key,
  sign,
  verify,
} from "./lib/signing";
import { withStorageBytes } from "./lib/storage";
import { rateLimiter } from "./rateLimits";

const TOUCH_AFTER_MS = 12 * 60 * 60 * 1000;
const UPLOAD_URL_TTL_MS = 60 * 60 * 1000;

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
          uploadUrl: await createUploadUrl(ctx, accountId, hash, now),
        });
      } else if (now - image.lastReferencedAt > TOUCH_AFTER_MS) {
        await ctx.db.patch("images", image._id, { lastReferencedAt: now });
      }
    }
    return targets;
  },
});

async function createUploadUrl(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  hash: string,
  now: number,
): Promise<string> {
  if (env.IMAGES_URL === undefined) {
    return ctx.storage.generateUploadUrl();
  }
  const normalized = hash.toLowerCase();
  const exp = now + UPLOAD_URL_TTL_MS;
  const sig = await sign(
    env.IMAGE_URL_SECRET,
    messages.upload(accountId, normalized, exp),
  );
  return `${env.IMAGES_URL}/upload/${accountId}/${normalized}?exp=${exp}&sig=${sig}`;
}

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
  if (upload.storageId.startsWith(R2_RECEIPT_PREFIX)) {
    return confirmR2Upload(ctx, accountId, upload);
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

async function confirmR2Upload(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
): Promise<Doc<"images"> | null> {
  const key = r2Key(accountId, upload.hash.toLowerCase());
  const [bytesText, sig, ...rest] = upload.storageId
    .slice(R2_RECEIPT_PREFIX.length)
    .split(".");
  const bytes = Number(bytesText);
  if (
    sig === undefined ||
    rest.length > 0 ||
    !Number.isSafeInteger(bytes) ||
    bytes > MAX_IMAGE_BYTES ||
    upload.width > MAX_IMAGE_WIDTH ||
    upload.height > MAX_IMAGE_HEIGHT ||
    !(await verify(env.IMAGE_URL_SECRET, messages.receipt(key, bytes), sig))
  ) {
    return null;
  }
  const existing = await findImage(ctx, accountId, upload.hash);
  if (existing !== null) {
    return existing;
  }
  return insertImage(
    ctx,
    accountId,
    upload,
    { store: "r2", r2Key: key },
    bytes,
  );
}

async function insertImage(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  upload: Upload,
  location:
    | { store: "convex"; storageId: Id<"_storage"> }
    | { store: "r2"; r2Key: string },
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
  if (image.store === "r2") {
    return image.r2Key === undefined || env.IMAGES_URL === undefined
      ? null
      : r2ImageUrl(project, { ...image, r2Key: image.r2Key }, env.IMAGES_URL);
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
  if (image.store === "r2" && image.r2Key !== undefined) {
    await ctx.scheduler.runAfter(0, internal.blobs.deleteR2Object, {
      key: image.r2Key,
      before: Date.now(),
    });
  }
  if (image.storageId !== undefined) {
    await ctx.storage.delete(image.storageId);
  }
  await ctx.db.delete("images", image._id);
}

export const deleteR2Object = internalAction({
  args: { key: v.string(), before: v.number() },
  returns: v.null(),
  handler: async (_ctx, { key, before }) => {
    if (env.IMAGES_URL === undefined) {
      throw new Error(`IMAGES_URL is not set, cannot delete ${key}`);
    }
    const sig = await sign(env.IMAGE_URL_SECRET, messages.delete(key, before));
    const response = await fetch(
      `${env.IMAGES_URL}/objects/${key}?before=${before}&sig=${sig}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Deleting ${key} failed with ${response.status}`);
    }
    return null;
  },
});
