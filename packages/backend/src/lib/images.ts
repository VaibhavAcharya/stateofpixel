import { eq } from "drizzle-orm";
import { z } from "zod";
import { getUrl } from "../blobs.ts";
import type { Doc, Id } from "../dataModel.ts";
import { first } from "../db/index.ts";
import { images } from "../schema.ts";
import type { QueryCtx } from "../server.ts";

export const imageInfo = z
  .object({ url: z.string(), width: z.number(), height: z.number() })
  .nullable();

export async function toImageInfo(
  ctx: QueryCtx,
  project: Doc<"projects">,
  imageId: Id<"images"> | null,
) {
  const image =
    imageId === null
      ? null
      : first(
          await ctx.db.select().from(images).where(eq(images._id, imageId)),
        );
  if (image === null) {
    return null;
  }
  const url = await getUrl(ctx, image, project);
  return url === null
    ? null
    : { url, width: image.width, height: image.height };
}
