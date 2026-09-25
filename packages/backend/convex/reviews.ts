import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
} from "./_generated/server";
import { touchCheck } from "./checks";
import { conclude } from "./lib/conclude";
import { requirePermission } from "./lib/permissions";
import type { buildCounts } from "./schema";

const MAX_SNAPSHOTS_PER_CALL = 100;
const ALL_PAGE_SIZE = 500;
const MAX_COMMENT_LENGTH = 500;

const reviewAction = v.union(
  v.literal("approve"),
  v.literal("reject"),
  v.literal("undo"),
);

type ReviewAction = Infer<typeof reviewAction>;
type Counts = Infer<typeof buildCounts>;
type Source = "user" | "approve_all";

const NEXT_STATE = {
  approve: "approved",
  reject: "rejected",
  undo: "pending",
} as const;

export const apply = mutation({
  args: {
    buildId: v.id("builds"),
    snapshotIds: v.union(v.array(v.id("snapshots")), v.literal("all")),
    action: reviewAction,
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, snapshotIds, action, comment }) => {
    const build = await ctx.db.get("builds", buildId);
    if (build === null) {
      throw new ConvexError({ code: "not_found" });
    }
    const { userId } = await requirePermission(ctx, build.projectId, "write");
    if (userId === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }
    checkReviewable(build);
    const trimmedComment = comment?.trim() || undefined;
    if (
      trimmedComment !== undefined &&
      (action !== "reject" || trimmedComment.length > MAX_COMMENT_LENGTH)
    ) {
      throw new ConvexError({ code: "invalid_comment" });
    }

    if (snapshotIds === "all") {
      if (action === "undo") {
        throw new ConvexError({ code: "invalid_action" });
      }
      const options = {
        action,
        userId,
        source: action === "approve" ? "approve_all" : "user",
        comment: trimmedComment,
      } as const;
      const counts = { ...build.counts };
      let truncated = false;
      for (const diffStatus of ["changed", "added"] as const) {
        const snapshots = await ctx.db
          .query("snapshots")
          .withIndex("by_buildId_and_diffStatus_and_name", (q) =>
            q.eq("buildId", buildId).eq("diffStatus", diffStatus),
          )
          .take(ALL_PAGE_SIZE);
        truncated ||= snapshots.length === ALL_PAGE_SIZE;
        await reviewPending(ctx, build, snapshots, counts, options);
      }
      await saveCounts(ctx, build, counts);
      if (truncated) {
        await ctx.scheduler.runAfter(0, internal.reviews.applyAll, {
          buildId,
          action,
          userId,
          comment: trimmedComment,
          diffStatus: "changed",
          cursor: null,
        });
      }
      return null;
    }

    if (snapshotIds.length > MAX_SNAPSHOTS_PER_CALL) {
      throw new ConvexError({ code: "too_many_snapshots" });
    }
    const counts = { ...build.counts };
    for (const snapshotId of snapshotIds) {
      const snapshot = await ctx.db.get("snapshots", snapshotId);
      if (snapshot === null || snapshot.buildId !== buildId) {
        throw new ConvexError({ code: "not_found" });
      }
      await review(ctx, build, snapshot, counts, {
        action,
        userId,
        source: "user",
        comment: trimmedComment,
      });
    }
    await saveCounts(ctx, build, counts);
    return null;
  },
});

export const applyAll = internalMutation({
  args: {
    buildId: v.id("builds"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    userId: v.id("users"),
    comment: v.optional(v.string()),
    diffStatus: v.union(v.literal("changed"), v.literal("added")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const build = await ctx.db.get("builds", args.buildId);
    if (build === null || !isReviewable(build)) {
      return null;
    }
    const page = await ctx.db
      .query("snapshots")
      .withIndex("by_buildId_and_diffStatus_and_name", (q) =>
        q.eq("buildId", args.buildId).eq("diffStatus", args.diffStatus),
      )
      .paginate({ numItems: ALL_PAGE_SIZE, cursor: args.cursor });
    const counts = { ...build.counts };
    await reviewPending(ctx, build, page.page, counts, {
      action: args.action,
      userId: args.userId,
      source: args.action === "approve" ? "approve_all" : "user",
      comment: args.comment,
    });
    await saveCounts(ctx, build, counts);

    const next = !page.isDone
      ? { diffStatus: args.diffStatus, cursor: page.continueCursor }
      : args.diffStatus === "changed"
        ? { diffStatus: "added" as const, cursor: null }
        : null;
    if (next !== null) {
      await ctx.scheduler.runAfter(0, internal.reviews.applyAll, {
        ...args,
        ...next,
      });
    }
    return null;
  },
});

function isReviewable(build: Doc<"builds">): boolean {
  return (
    build.status === "finalized" &&
    build.supersededById === undefined &&
    !build.storageBlocked
  );
}

function checkReviewable(build: Doc<"builds">) {
  if (!isReviewable(build)) {
    throw new ConvexError({ code: "build_not_reviewable" });
  }
}

async function reviewPending(
  ctx: MutationCtx,
  build: Doc<"builds">,
  snapshots: Doc<"snapshots">[],
  counts: Counts,
  options: Parameters<typeof review>[4],
) {
  for (const snapshot of snapshots) {
    if (snapshot.reviewState === "pending") {
      await review(ctx, build, snapshot, counts, options);
    }
  }
}

async function review(
  ctx: MutationCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
  counts: Counts,
  {
    action,
    userId,
    source,
    comment,
  }: {
    action: ReviewAction;
    userId: Id<"users">;
    source: Source;
    comment?: string;
  },
) {
  const next = NEXT_STATE[action];
  const current = snapshot.reviewState;
  if (current === "none" || current === next) {
    return;
  }
  counts[current]--;
  counts[next]++;
  await ctx.db.patch("snapshots", snapshot._id, { reviewState: next });
  const reviewId = await ctx.db.insert("reviews", {
    snapshotId: snapshot._id,
    buildId: build._id,
    userId,
    action,
    source,
    comment,
  });

  if (build.prNumber === undefined || snapshot.imageId === undefined) {
    return;
  }
  if (next === "approved") {
    await ctx.db.insert("approvedImages", {
      projectId: build.projectId,
      buildName: build.buildName,
      prNumber: build.prNumber,
      imageId: snapshot.imageId,
      reviewId,
    });
  } else if (current === "approved") {
    await removeApprovals(ctx, build, snapshot);
  }
}

async function removeApprovals(
  ctx: MutationCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
) {
  const approvals = await ctx.db
    .query("approvedImages")
    .withIndex("by_projectId_and_buildName_and_prNumber_and_imageId", (q) =>
      q
        .eq("projectId", build.projectId)
        .eq("buildName", build.buildName)
        .eq("prNumber", build.prNumber as number)
        .eq("imageId", snapshot.imageId as Id<"images">),
    )
    .take(100);
  for (const approval of approvals) {
    const approvalReview = await ctx.db.get("reviews", approval.reviewId);
    if (approvalReview?.snapshotId === snapshot._id) {
      await ctx.db.delete("approvedImages", approval._id);
    }
  }
}

async function saveCounts(
  ctx: MutationCtx,
  build: Doc<"builds">,
  counts: Counts,
) {
  await ctx.db.patch("builds", build._id, {
    counts,
    conclusion: conclude(counts),
  });
  await touchCheck(ctx, build._id);
}
