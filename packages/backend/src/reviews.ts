import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { touchCheck } from "./checks.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import { conclude } from "./lib/conclude.ts";
import { requirePermission } from "./lib/permissions.ts";
import {
  approvedImages,
  type buildCounts,
  builds,
  reviews,
  snapshots,
} from "./schema.ts";
import {
  AppError,
  internalMutation,
  type MutationCtx,
  mutation,
  paginate,
  type QueryCtx,
} from "./server.ts";

const MAX_SNAPSHOTS_PER_CALL = 100;
const ALL_PAGE_SIZE = 500;
const MAX_COMMENT_LENGTH = 500;

const reviewAction = z.enum(["approve", "reject", "undo"]);

type ReviewAction = z.infer<typeof reviewAction>;
type Counts = z.infer<typeof buildCounts>;
type Source = "user" | "approve_all" | "reject_all";

const BUILD_SOURCES = new Set(["approve_all", "reject_all"]);

const BUILD_SOURCE = { approve: "approve_all", reject: "reject_all" } as const;

const NEXT_STATE = {
  approve: "approved",
  reject: "rejected",
  undo: "pending",
} as const;

async function getBuild(
  ctx: QueryCtx,
  buildId: Id<"builds">,
): Promise<Doc<"builds"> | null> {
  return first(
    await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
  );
}

function snapshotsByDiffStatus(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  diffStatus: "changed" | "added",
) {
  return ctx.db
    .select()
    .from(snapshots)
    .where(
      and(eq(snapshots.buildId, buildId), eq(snapshots.diffStatus, diffStatus)),
    )
    .orderBy(
      asc(snapshots.name),
      asc(snapshots._creationTime),
      asc(snapshots._id),
    );
}

export const apply = mutation({
  args: {
    buildId: z.string(),
    snapshotIds: z.union([z.array(z.string()), z.literal("all")]),
    action: reviewAction,
    comment: z.string().optional(),
  },
  handler: async (ctx, { buildId, snapshotIds, action, comment }) => {
    const build = await getBuild(ctx, buildId);
    if (build === null) {
      throw new AppError({ code: "not_found" });
    }
    const { userId } = await requirePermission(ctx, build.projectId, "write");
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    checkReviewable(build);
    const trimmedComment = comment?.trim() || undefined;
    if (
      trimmedComment !== undefined &&
      (action !== "reject" || trimmedComment.length > MAX_COMMENT_LENGTH)
    ) {
      throw new AppError({ code: "invalid_comment" });
    }

    if (snapshotIds === "all") {
      const undoAll = action === "undo" && build.buildAction === null;
      const options = {
        action,
        userId,
        source: action === "undo" ? "user" : BUILD_SOURCE[action],
        comment: trimmedComment,
        undoAll,
      } as const;
      const counts = { ...build.counts };
      let truncated = false;
      for (const diffStatus of ["changed", "added"] as const) {
        const page = await snapshotsByDiffStatus(
          ctx,
          buildId,
          diffStatus,
        ).limit(ALL_PAGE_SIZE);
        truncated ||= page.length === ALL_PAGE_SIZE;
        await reviewBuildPage(ctx, build, page, counts, options);
      }
      await saveCounts(ctx, build, counts);
      await ctx.db
        .update(builds)
        .set({ buildAction: action === "undo" ? null : action })
        .where(eq(builds._id, build._id));
      if (truncated) {
        await ctx.scheduler.runAfter(0, internal.reviews.applyAll, {
          buildId,
          action,
          userId,
          comment: trimmedComment,
          undoAll,
          diffStatus: "changed",
          cursor: null,
        });
      }
      return null;
    }

    if (snapshotIds.length > MAX_SNAPSHOTS_PER_CALL) {
      throw new AppError({ code: "too_many_snapshots" });
    }
    const counts = { ...build.counts };
    for (const snapshotId of snapshotIds) {
      const snapshot = first(
        await ctx.db
          .select()
          .from(snapshots)
          .where(eq(snapshots._id, snapshotId)),
      );
      if (snapshot === null || snapshot.buildId !== buildId) {
        throw new AppError({ code: "not_found" });
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
    buildId: z.string(),
    action: reviewAction,
    userId: z.string(),
    comment: z.string().optional(),
    undoAll: z.boolean().optional(),
    diffStatus: z.enum(["changed", "added"]),
    cursor: z.string().nullable(),
  },
  handler: async (ctx, args) => {
    const build = await getBuild(ctx, args.buildId);
    if (
      build === null ||
      !isReviewable(build) ||
      build.buildAction !== (args.action === "undo" ? null : args.action)
    ) {
      return null;
    }
    const page = await paginate(
      { numItems: ALL_PAGE_SIZE, cursor: args.cursor },
      (limit, offset) =>
        snapshotsByDiffStatus(ctx, args.buildId, args.diffStatus)
          .limit(limit)
          .offset(offset),
    );
    const counts = { ...build.counts };
    await reviewBuildPage(ctx, build, page.page, counts, {
      action: args.action,
      userId: args.userId,
      source: args.action === "undo" ? "user" : BUILD_SOURCE[args.action],
      comment: args.comment,
      undoAll: args.undoAll ?? false,
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
    build.supersededById === null &&
    !build.storageBlocked
  );
}

function checkReviewable(build: Doc<"builds">) {
  if (!isReviewable(build)) {
    throw new AppError({ code: "build_not_reviewable" });
  }
}

async function latestSources(
  ctx: MutationCtx,
  snapshotIds: Id<"snapshots">[],
): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  if (snapshotIds.length === 0) {
    return sources;
  }
  const rows = await ctx.db
    .select({ snapshotId: reviews.snapshotId, source: reviews.source })
    .from(reviews)
    .where(inArray(reviews.snapshotId, snapshotIds))
    .orderBy(desc(reviews._creationTime), desc(reviews._id));
  for (const row of rows) {
    if (!sources.has(row.snapshotId)) {
      sources.set(row.snapshotId, row.source);
    }
  }
  return sources;
}

async function reviewBuildPage(
  ctx: MutationCtx,
  build: Doc<"builds">,
  snapshots: Doc<"snapshots">[],
  counts: Counts,
  options: Parameters<typeof review>[4] & { undoAll: boolean },
) {
  const sources = await latestSources(
    ctx,
    snapshots
      .filter(
        (snapshot) =>
          snapshot.reviewState === "approved" ||
          snapshot.reviewState === "rejected",
      )
      .map((snapshot) => snapshot._id),
  );
  for (const snapshot of snapshots) {
    const fromBuildAction = BUILD_SOURCES.has(sources.get(snapshot._id) ?? "");
    const selected =
      options.action === "undo"
        ? options.undoAll || fromBuildAction
        : snapshot.reviewState === "pending" || fromBuildAction;
    if (selected) {
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
  await ctx.db
    .update(snapshots)
    .set({ reviewState: next })
    .where(eq(snapshots._id, snapshot._id));
  const { _id: reviewId } = one(
    await ctx.db
      .insert(reviews)
      .values({
        snapshotId: snapshot._id,
        buildId: build._id,
        userId,
        action,
        source,
        comment,
      })
      .returning({ _id: reviews._id }),
  );

  if (build.prNumber === null || snapshot.imageId === null) {
    return;
  }
  if (next === "approved") {
    await ctx.db.insert(approvedImages).values({
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
    .select()
    .from(approvedImages)
    .where(
      and(
        eq(approvedImages.projectId, build.projectId),
        eq(approvedImages.buildName, build.buildName),
        eq(approvedImages.prNumber, build.prNumber as number),
        eq(approvedImages.imageId, snapshot.imageId as Id<"images">),
      ),
    )
    .orderBy(asc(approvedImages._creationTime), asc(approvedImages._id))
    .limit(100);
  for (const approval of approvals) {
    await ctx.db
      .delete(approvedImages)
      .where(eq(approvedImages._id, approval._id));
  }
}

async function saveCounts(
  ctx: MutationCtx,
  build: Doc<"builds">,
  counts: Counts,
) {
  await ctx.db
    .update(builds)
    .set({
      counts,
      conclusion: conclude(counts),
    })
    .where(eq(builds._id, build._id));
  await touchCheck(ctx, build._id);
}
