import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { getUrl } from "./blobs";
import { requirePermission } from "./lib/permissions";
import { diffStatus, reviewState } from "./schema";

async function requireBuild(ctx: QueryCtx, buildId: Id<"builds">) {
  const build = await ctx.db.get("builds", buildId);
  if (build === null) {
    return null;
  }
  await requirePermission(ctx, build.projectId, "read");
  return build;
}

export const list = query({
  args: {
    buildId: v.id("builds"),
    diffStatus,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      id: v.id("snapshots"),
      name: v.string(),
      diffStatus,
      reviewState,
      diffRatio: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const build = await requireBuild(ctx, args.buildId);
    if (build === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const page = await ctx.db
      .query("snapshots")
      .withIndex("by_buildId_and_diffStatus_and_name", (q) =>
        q.eq("buildId", args.buildId).eq("diffStatus", args.diffStatus),
      )
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.map((snapshot) => ({
        id: snapshot._id,
        name: snapshot.name,
        diffStatus: snapshot.diffStatus,
        reviewState: snapshot.reviewState,
        diffRatio: snapshot.diffRatio ?? null,
      })),
    };
  },
});

const imageInfo = v.union(
  v.null(),
  v.object({ url: v.string(), width: v.number(), height: v.number() }),
);

async function toImageInfo(ctx: QueryCtx, imageId: Id<"images"> | undefined) {
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

export const get = query({
  args: { buildId: v.id("builds"), snapshotId: v.id("snapshots") },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("snapshots"),
      name: v.string(),
      diffStatus,
      reviewState,
      diffRatio: v.union(v.number(), v.null()),
      diffPixels: v.union(v.number(), v.null()),
      metadata: v.record(v.string(), v.any()),
      image: imageInfo,
      baselineImage: imageInfo,
      diffImage: imageInfo,
      lastReview: v.union(
        v.null(),
        v.object({
          action: v.union(
            v.literal("approve"),
            v.literal("reject"),
            v.literal("undo"),
          ),
          source: v.string(),
          login: v.union(v.string(), v.null()),
          comment: v.union(v.string(), v.null()),
          createdAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { buildId, snapshotId }) => {
    const build = await requireBuild(ctx, buildId);
    const snapshot = await ctx.db.get("snapshots", snapshotId);
    if (build === null || snapshot === null || snapshot.buildId !== buildId) {
      return null;
    }
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .order("desc")
      .first();
    return {
      id: snapshot._id,
      name: snapshot.name,
      diffStatus: snapshot.diffStatus,
      reviewState: snapshot.reviewState,
      diffRatio: snapshot.diffRatio ?? null,
      diffPixels: snapshot.diffPixels ?? null,
      metadata: snapshot.metadata,
      image: await toImageInfo(ctx, snapshot.imageId),
      baselineImage: await toImageInfo(ctx, snapshot.baselineImageId),
      diffImage: await toImageInfo(ctx, snapshot.diffImageId),
      lastReview: review === null ? null : await toReviewInfo(ctx, review),
    };
  },
});

async function toReviewInfo(ctx: QueryCtx, review: Doc<"reviews">) {
  const user =
    review.userId === undefined
      ? null
      : await ctx.db.get("users", review.userId);
  return {
    action: review.action,
    source: review.source,
    login: user?.login ?? null,
    comment: review.comment ?? null,
    createdAt: review._creationTime,
  };
}
