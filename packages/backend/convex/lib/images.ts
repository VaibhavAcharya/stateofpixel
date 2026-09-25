import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getUrl } from "../blobs";

export const imageInfo = v.union(
  v.null(),
  v.object({ url: v.string(), width: v.number(), height: v.number() }),
);

export async function toImageInfo(
  ctx: QueryCtx,
  imageId: Id<"images"> | undefined,
) {
  const image =
    imageId === undefined ? null : await ctx.db.get("images", imageId);
  if (image === null) {
    return null;
  }
  const url = await getUrl(ctx, image);
  return url === null
    ? null
    : { url, width: image.width, height: image.height };
}
