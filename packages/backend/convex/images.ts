import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction, internalQuery, mutation } from "./_generated/server";
import { readImage } from "./blobs";
import { createGrant, IMAGE_ROUTE, verifyGrant } from "./lib/imageUrls";
import { requirePermission } from "./lib/permissions";

export const grant = mutation({
  args: { projectId: v.id("projects") },
  returns: v.object({ exp: v.number(), sig: v.string() }),
  handler: async (ctx, { projectId }) => {
    await requirePermission(ctx, projectId, "read");
    return createGrant(projectId, Date.now());
  },
});

export const storageIdFor = internalQuery({
  args: { projectId: v.string(), imageId: v.string() },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    const imageId = ctx.db.normalizeId("images", args.imageId);
    if (projectId === null || imageId === null) {
      return null;
    }
    const project = await ctx.db.get("projects", projectId);
    const image = await ctx.db.get("images", imageId);
    if (
      project === null ||
      project.archivedAt !== undefined ||
      image === null ||
      image.accountId !== project.accountId
    ) {
      return null;
    }
    return image.storageId ?? null;
  },
});

export const serve = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const [projectId, imageId, ...rest] = url.pathname
    .slice(IMAGE_ROUTE.length)
    .split("/");
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (
    projectId === undefined ||
    imageId === undefined ||
    rest.length > 0 ||
    !(await verifyGrant(projectId, exp, sig, Date.now()))
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  const storageId: Id<"_storage"> | null = await ctx.runQuery(
    internal.images.storageIdFor,
    {
      projectId,
      imageId,
    },
  );
  const blob = storageId === null ? null : await readImage(ctx, storageId);
  if (blob === null) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(blob, {
    headers: {
      "Content-Type": blob.type || "image/png",
      "Cache-Control": `private, max-age=${Math.max(
        0,
        Math.floor((exp - Date.now()) / 1000),
      )}, immutable`,
    },
  });
});
