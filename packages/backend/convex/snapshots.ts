import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { findChanges, findFlaky } from "./lib/history";
import { imageInfo, toImageInfo } from "./lib/images";
import { findAllowedProject, findReadableBuild } from "./lib/permissions";
import { diffStatus, reviewState } from "./schema";

const MAX_REJECTION_LOOKUPS = 20;
const MAX_HISTORY = 10;

async function findReadableBuildById(ctx: QueryCtx, buildId: Id<"builds">) {
  const build = await ctx.db.get("builds", buildId);
  if (
    build === null ||
    (await findAllowedProject(ctx, build.projectId, "read")) === null
  ) {
    return null;
  }
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
    const build = await findReadableBuildById(ctx, args.buildId);
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

export const get = query({
  args: {
    owner: v.string(),
    name: v.string(),
    number: v.number(),
    snapshotId: v.id("snapshots"),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("snapshots"),
      buildId: v.id("builds"),
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
          carriedFrom: v.union(
            v.null(),
            v.object({
              buildNumber: v.number(),
              login: v.union(v.string(), v.null()),
            }),
          ),
        }),
      ),
      rejectedIn: v.union(v.number(), v.null()),
      notReviewedOnPr: v.boolean(),
      history: v.array(v.number()),
      flaky: v.union(
        v.null(),
        v.object({
          flips: v.number(),
          builds: v.number(),
          sameCommitBuild: v.union(v.number(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { snapshotId, ...buildArgs }) => {
    const build = await findReadableBuild(ctx, buildArgs);
    const snapshot = await ctx.db.get("snapshots", snapshotId);
    if (build === null || snapshot === null || snapshot.buildId !== build._id) {
      return null;
    }
    const project = await ctx.db.get("projects", build.projectId);
    if (project === null) {
      return null;
    }
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .order("desc")
      .first();
    return {
      id: snapshot._id,
      buildId: build._id,
      name: snapshot.name,
      diffStatus: snapshot.diffStatus,
      reviewState: snapshot.reviewState,
      diffRatio: snapshot.diffRatio ?? null,
      diffPixels: snapshot.diffPixels ?? null,
      metadata: snapshot.metadata,
      image: await toImageInfo(ctx, project, snapshot.imageId),
      baselineImage: await toImageInfo(ctx, project, snapshot.baselineImageId),
      diffImage: await toImageInfo(ctx, project, snapshot.diffImageId),
      lastReview: review === null ? null : await toReviewInfo(ctx, review),
      rejectedIn:
        snapshot.reviewState === "pending"
          ? await findEarlierRejection(ctx, build, snapshot)
          : null,
      notReviewedOnPr: await isNotReviewedOnPr(ctx, build, snapshot),
      history: await findHistory(ctx, build, snapshot),
      flaky: await findFlaky(ctx, project, build, snapshot),
    };
  },
});

async function findHistory(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<number[]> {
  const project = await ctx.db.get("projects", build.projectId);
  if (project === null) {
    return [];
  }
  const changes = await findChanges(
    ctx,
    project,
    build.baselineBranch,
    build.buildName,
    snapshot.name,
    MAX_HISTORY + 1,
  );
  return changes
    .map((change) => change.build.number)
    .filter((number) => number !== build.number)
    .slice(0, MAX_HISTORY);
}

async function findEarlierRejection(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<number | null> {
  if (build.prNumber === undefined || snapshot.imageId === undefined) {
    return null;
  }
  const sameImage = await ctx.db
    .query("snapshots")
    .withIndex("by_imageId", (q) => q.eq("imageId", snapshot.imageId))
    .order("desc")
    .take(MAX_REJECTION_LOOKUPS);
  for (const other of sameImage) {
    if (other.reviewState !== "rejected") {
      continue;
    }
    const otherBuild = await ctx.db.get("builds", other.buildId);
    if (
      otherBuild !== null &&
      otherBuild.projectId === build.projectId &&
      otherBuild.buildName === build.buildName &&
      otherBuild.prNumber === build.prNumber &&
      otherBuild.number < build.number
    ) {
      return otherBuild.number;
    }
  }
  return null;
}

async function isNotReviewedOnPr(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<boolean> {
  const { mergedPrNumber } = build;
  const { imageId } = snapshot;
  if (
    mergedPrNumber === undefined ||
    imageId === undefined ||
    (snapshot.diffStatus !== "changed" && snapshot.diffStatus !== "added")
  ) {
    return false;
  }
  const approval = await ctx.db
    .query("approvedImages")
    .withIndex("by_projectId_and_buildName_and_prNumber_and_imageId", (q) =>
      q
        .eq("projectId", build.projectId)
        .eq("buildName", build.buildName)
        .eq("prNumber", mergedPrNumber)
        .eq("imageId", imageId),
    )
    .first();
  return approval === null;
}

async function findLogin(ctx: QueryCtx, userId: Id<"users"> | undefined) {
  const user = userId === undefined ? null : await ctx.db.get("users", userId);
  return user?.login ?? null;
}

async function toReviewInfo(ctx: QueryCtx, review: Doc<"reviews">) {
  const source =
    review.sourceReviewId === undefined
      ? null
      : await ctx.db.get("reviews", review.sourceReviewId);
  const sourceBuild =
    source === null ? null : await ctx.db.get("builds", source.buildId);
  return {
    action: review.action,
    source: review.source,
    login: await findLogin(ctx, review.userId),
    comment: review.comment ?? null,
    createdAt: review._creationTime,
    carriedFrom:
      source === null || sourceBuild === null
        ? null
        : {
            buildNumber: sourceBuild.number,
            login: await findLogin(ctx, source.userId),
          },
  };
}
