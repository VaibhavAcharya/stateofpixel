import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { findChanges, findFlaky } from "./lib/history.ts";
import { toImageInfo } from "./lib/images.ts";
import { findAllowedProject, findReadableBuild } from "./lib/permissions.ts";
import {
  approvedImages,
  builds,
  comments,
  connections,
  diffStatus,
  projects,
  reviews,
  snapshots,
} from "./schema.ts";
import {
  paginate,
  paginationOptsValidator,
  type QueryCtx,
  query,
} from "./server.ts";

async function getBuild(ctx: QueryCtx, buildId: Id<"builds">) {
  return first(
    await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
  );
}

async function getProject(ctx: QueryCtx, projectId: Id<"projects">) {
  return first(
    await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
  );
}

async function getReview(ctx: QueryCtx, reviewId: Id<"reviews">) {
  return first(
    await ctx.db.select().from(reviews).where(eq(reviews._id, reviewId)),
  );
}

const MAX_REJECTION_LOOKUPS = 20;
const MAX_HISTORY = 10;

async function findReadableBuildById(ctx: QueryCtx, buildId: Id<"builds">) {
  const build = await getBuild(ctx, buildId);
  if (
    build === null ||
    (await findAllowedProject(ctx, build.projectId, "read")) === null
  ) {
    return null;
  }
  return build;
}

const MAX_COMMENTS = 50;

export const list = query({
  args: {
    buildId: z.string(),
    diffStatus,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const build = await findReadableBuildById(ctx, args.buildId);
    if (build === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const page = await paginate(args.paginationOpts, (limit, offset) =>
      ctx.db
        .select()
        .from(snapshots)
        .where(
          and(
            eq(snapshots.buildId, args.buildId),
            eq(snapshots.diffStatus, args.diffStatus),
          ),
        )
        .orderBy(
          asc(snapshots.name),
          asc(snapshots._creationTime),
          asc(snapshots._id),
        )
        .limit(limit)
        .offset(offset),
    );
    return {
      ...page,
      page: page.page.map((snapshot) => ({
        id: snapshot._id,
        name: snapshot.name,
        diffStatus: snapshot.diffStatus,
        reviewState: snapshot.reviewState,
        diffRatio: snapshot.diffRatio,
        browser:
          typeof snapshot.metadata.browser === "string"
            ? snapshot.metadata.browser
            : null,
      })),
    };
  },
});

export const get = query({
  args: {
    owner: z.string(),
    name: z.string(),
    number: z.number(),
    snapshotId: z.string(),
  },
  handler: async (ctx, { snapshotId, ...buildArgs }) => {
    const build = await findReadableBuild(ctx, buildArgs);
    const snapshot = first(
      await ctx.db
        .select()
        .from(snapshots)
        .where(eq(snapshots._id, snapshotId)),
    );
    if (build === null || snapshot === null || snapshot.buildId !== build._id) {
      return null;
    }
    const project = await getProject(ctx, build.projectId);
    if (project === null) {
      return null;
    }
    const review = first(
      await ctx.db
        .select()
        .from(reviews)
        .where(eq(reviews.snapshotId, snapshotId))
        .orderBy(desc(reviews._creationTime), desc(reviews._id))
        .limit(1),
    );
    return {
      id: snapshot._id,
      buildId: build._id,
      name: snapshot.name,
      diffStatus: snapshot.diffStatus,
      reviewState: snapshot.reviewState,
      diffRatio: snapshot.diffRatio,
      diffPixels: snapshot.diffPixels,
      metadata: snapshot.metadata,
      image: await toImageInfo(ctx, project, snapshot.imageId),
      baselineImage: await toImageInfo(ctx, project, snapshot.baselineImageId),
      diffImage: await toImageInfo(ctx, project, snapshot.diffImageId),
      lastReview: review === null ? null : await toReviewInfo(ctx, review),
      comments: await findComments(ctx, snapshot._id),
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

type Comment = {
  id: string;
  action: "approve" | "reject" | null;
  userId: Id<"users"> | null;
  body: string;
  createdAt: number;
};

async function findComments(ctx: QueryCtx, snapshotId: Id<"snapshots">) {
  const reviewRows = await ctx.db
    .select()
    .from(reviews)
    .where(and(eq(reviews.snapshotId, snapshotId), isNotNull(reviews.comment)))
    .orderBy(desc(reviews._creationTime))
    .limit(MAX_COMMENTS);
  const commentRows = await ctx.db
    .select()
    .from(comments)
    .where(eq(comments.snapshotId, snapshotId))
    .orderBy(desc(comments._creationTime))
    .limit(MAX_COMMENTS);
  const rows = [
    ...reviewRows.map(
      (row): Comment => ({
        id: row._id,
        action:
          row.action === "approve" || row.action === "reject"
            ? row.action
            : null,
        userId: row.userId,
        body: row.comment ?? "",
        createdAt: row._creationTime,
      }),
    ),
    ...commentRows.map(
      (row): Comment => ({
        id: row._id,
        action: null,
        userId: row.userId,
        body: row.body,
        createdAt: row._creationTime,
      }),
    ),
  ]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_COMMENTS);
  return Promise.all(
    rows.map(async ({ userId, ...row }) => ({
      ...row,
      login: await findLogin(ctx, userId),
    })),
  );
}

async function findHistory(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<number[]> {
  const project = await getProject(ctx, build.projectId);
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
  if (build.prNumber === null || snapshot.imageId === null) {
    return null;
  }
  const sameImage = await ctx.db
    .select()
    .from(snapshots)
    .where(eq(snapshots.imageId, snapshot.imageId))
    .orderBy(desc(snapshots._creationTime), desc(snapshots._id))
    .limit(MAX_REJECTION_LOOKUPS);
  for (const other of sameImage) {
    if (other.reviewState !== "rejected") {
      continue;
    }
    const otherBuild = await getBuild(ctx, other.buildId);
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
    mergedPrNumber === null ||
    imageId === null ||
    (snapshot.diffStatus !== "changed" && snapshot.diffStatus !== "added")
  ) {
    return false;
  }
  const approval = first(
    await ctx.db
      .select({ _id: approvedImages._id })
      .from(approvedImages)
      .where(
        and(
          eq(approvedImages.projectId, build.projectId),
          eq(approvedImages.buildName, build.buildName),
          eq(approvedImages.prNumber, mergedPrNumber),
          eq(approvedImages.imageId, imageId),
        ),
      )
      .limit(1),
  );
  return approval === null;
}

async function findLogin(ctx: QueryCtx, userId: Id<"users"> | null) {
  const connection =
    userId === null
      ? null
      : first(
          await ctx.db
            .select({ login: connections.login })
            .from(connections)
            .where(
              and(
                eq(connections.userId, userId),
                eq(connections.provider, "github"),
              ),
            ),
        );
  return connection?.login ?? null;
}

async function toReviewInfo(ctx: QueryCtx, review: Doc<"reviews">) {
  const source =
    review.sourceReviewId === null
      ? null
      : await getReview(ctx, review.sourceReviewId);
  const sourceBuild =
    source === null ? null : await getBuild(ctx, source.buildId);
  return {
    action: review.action,
    source: review.source,
    login: await findLogin(ctx, review.userId),
    comment: review.comment,
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
