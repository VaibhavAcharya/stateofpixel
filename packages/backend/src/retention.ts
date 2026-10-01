import { and, asc, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { deleteImage } from "./blobs.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { isKeptBranch } from "./lib/matchesBranch.ts";
import { withStorageBytes } from "./lib/storage.ts";
import {
  accounts,
  approvedImages,
  builds,
  deletedBuilds,
  githubEvents,
  images,
  projects,
  reviews,
  snapshots,
} from "./schema.ts";
import {
  internalMutation,
  type MutationCtx,
  paginate,
  type QueryCtx,
} from "./server.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_GRACE_MS = DAY_MS;
const EVENT_RETENTION_MS = 7 * DAY_MS;
const SCAN_PAGE_SIZE = 100;
const DELETE_PAGE_SIZE = 500;
const MAX_PR_BUILDS = 1000;

export const setPrClosed = internalMutation({
  args: {
    providerRepoId: z.number(),
    prNumber: z.number(),
    closed: z.boolean(),
    merged: z.boolean().optional(),
  },
  handler: async (ctx, { providerRepoId, prNumber, closed, merged }) => {
    const project = first(
      await ctx.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.provider, "github"),
            eq(projects.providerRepoId, providerRepoId),
          ),
        )
        .limit(1),
    );
    if (project === null) {
      return null;
    }
    const prBuilds = await ctx.db
      .select()
      .from(builds)
      .where(
        and(eq(builds.projectId, project._id), eq(builds.prNumber, prNumber)),
      )
      .orderBy(asc(builds._creationTime), asc(builds._id))
      .limit(MAX_PR_BUILDS);
    const prClosedAt = closed ? Date.now() : null;
    const prMergedAt = closed && merged === true ? prClosedAt : null;
    for (const build of prBuilds) {
      await ctx.db
        .update(builds)
        .set({ prClosedAt, prMergedAt })
        .where(eq(builds._id, build._id));
    }
    return null;
  },
});

export const deleteOldBuilds = internalMutation({
  args: {
    cursor: z.string().nullable().optional(),
    startedAt: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const page = await paginate(
      { numItems: SCAN_PAGE_SIZE, cursor: args.cursor ?? null },
      (limit, offset) =>
        ctx.db
          .select()
          .from(builds)
          .orderBy(desc(builds._creationTime), desc(builds._id))
          .limit(limit)
          .offset(offset),
    );
    const projectsById = new Map<Id<"projects">, Doc<"projects"> | null>();
    for (const build of page.page) {
      if (!projectsById.has(build.projectId)) {
        projectsById.set(
          build.projectId,
          first(
            await ctx.db
              .select()
              .from(projects)
              .where(eq(projects._id, build.projectId)),
          ),
        );
      }
      const project = projectsById.get(build.projectId) ?? null;
      const reason =
        project === null
          ? null
          : await retentionReason(ctx, project, build, startedAt);
      if (project !== null && reason !== null) {
        await ctx.db.delete(builds).where(eq(builds._id, build._id));
        await ctx.db.insert(deletedBuilds).values({
          projectId: build.projectId,
          number: build.number,
          branch: build.branch,
          prNumber: build.prNumber,
          reason,
          retentionDays: project.prRetentionDays,
        });
        await ctx.scheduler.runAfter(0, internal.retention.deleteBuildData, {
          buildId: build._id,
        });
        if (build.prNumber !== null) {
          await ctx.scheduler.runAfter(0, internal.retention.deleteApprovals, {
            projectId: build.projectId,
            buildName: build.buildName,
            prNumber: build.prNumber,
          });
        }
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.retention.deleteOldBuilds, {
        cursor: page.continueCursor,
        startedAt,
      });
    }
    return null;
  },
});

async function retentionReason(
  ctx: QueryCtx,
  project: Doc<"projects">,
  build: Doc<"builds">,
  now: number,
): Promise<Doc<"deletedBuilds">["reason"] | null> {
  if (build.status === "pending" || isKeptBranch(project, build.branch)) {
    return null;
  }
  const cutoff = now - project.prRetentionDays * DAY_MS;
  const lastOnBranch = first(
    await ctx.db
      .select()
      .from(builds)
      .where(
        and(
          eq(builds.projectId, build.projectId),
          eq(builds.branch, build.branch),
        ),
      )
      .orderBy(desc(builds._creationTime), desc(builds._id))
      .limit(1),
  );
  const reason =
    build.prClosedAt !== null && build.prClosedAt < cutoff
      ? "pr_closed"
      : (lastOnBranch?._creationTime ?? build._creationTime) < cutoff
        ? "branch_inactive"
        : null;
  if (reason === null) {
    return null;
  }
  const usedAsBaseline = first(
    await ctx.db
      .select({ _id: builds._id })
      .from(builds)
      .where(eq(builds.baselineBuildId, build._id))
      .limit(1),
  );
  return usedAsBaseline === null ? reason : null;
}

export const deleteBuildData = internalMutation({
  args: { buildId: z.string() },
  handler: async (ctx, { buildId }) => {
    if (!(await deleteBuildRows(ctx, buildId))) {
      await ctx.scheduler.runAfter(0, internal.retention.deleteBuildData, {
        buildId,
      });
    }
    return null;
  },
});

export async function deleteBuildRows(
  ctx: MutationCtx,
  buildId: Id<"builds">,
): Promise<boolean> {
  const snapshotIds = await ctx.db
    .select({ _id: snapshots._id })
    .from(snapshots)
    .where(eq(snapshots.buildId, buildId))
    .limit(DELETE_PAGE_SIZE);
  const reviewIds = await ctx.db
    .select({ _id: reviews._id })
    .from(reviews)
    .where(eq(reviews.buildId, buildId))
    .limit(DELETE_PAGE_SIZE);
  for (const snapshot of snapshotIds) {
    await ctx.db.delete(snapshots).where(eq(snapshots._id, snapshot._id));
  }
  for (const review of reviewIds) {
    await ctx.db.delete(reviews).where(eq(reviews._id, review._id));
  }
  return (
    snapshotIds.length < DELETE_PAGE_SIZE && reviewIds.length < DELETE_PAGE_SIZE
  );
}

export const deleteApprovals = internalMutation({
  args: {
    projectId: z.string(),
    buildName: z.string(),
    prNumber: z.number(),
  },
  handler: async (ctx, args) => {
    const remainingBuild = first(
      await ctx.db
        .select({ _id: builds._id })
        .from(builds)
        .where(
          and(
            eq(builds.projectId, args.projectId),
            eq(builds.buildName, args.buildName),
            eq(builds.prNumber, args.prNumber),
          ),
        )
        .limit(1),
    );
    if (remainingBuild !== null) {
      return null;
    }
    const approvals = await ctx.db
      .select({ _id: approvedImages._id })
      .from(approvedImages)
      .where(
        and(
          eq(approvedImages.projectId, args.projectId),
          eq(approvedImages.buildName, args.buildName),
          eq(approvedImages.prNumber, args.prNumber),
        ),
      )
      .limit(DELETE_PAGE_SIZE);
    for (const approval of approvals) {
      await ctx.db
        .delete(approvedImages)
        .where(eq(approvedImages._id, approval._id));
    }
    if (approvals.length === DELETE_PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, internal.retention.deleteApprovals, args);
    }
    return null;
  },
});

export const collectImages = internalMutation({
  args: {
    cursor: z.string().nullable().optional(),
    startedAt: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const page = await paginate(
      { numItems: SCAN_PAGE_SIZE, cursor: args.cursor ?? null },
      (limit, offset) =>
        ctx.db
          .select()
          .from(images)
          .orderBy(asc(images._creationTime), asc(images._id))
          .limit(limit)
          .offset(offset),
    );
    const freedBytes = new Map<Id<"accounts">, number>();
    for (const image of page.page) {
      if (
        image.lastReferencedAt < startedAt - IMAGE_GRACE_MS &&
        !(await isReferenced(ctx, image._id))
      ) {
        await deleteImage(ctx, image);
        freedBytes.set(
          image.accountId,
          (freedBytes.get(image.accountId) ?? 0) + image.bytes,
        );
      }
    }
    for (const [accountId, bytes] of freedBytes) {
      const account = first(
        await ctx.db.select().from(accounts).where(eq(accounts._id, accountId)),
      );
      if (account !== null) {
        await ctx.db
          .update(accounts)
          .set(
            withStorageBytes(
              account,
              Math.max(0, account.storageBytes - bytes),
              Date.now(),
            ),
          )
          .where(eq(accounts._id, accountId));
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.retention.collectImages, {
        cursor: page.continueCursor,
        startedAt,
      });
    }
    return null;
  },
});

async function isReferenced(
  ctx: QueryCtx,
  imageId: Id<"images">,
): Promise<boolean> {
  const snapshot = first(
    await ctx.db
      .select({ _id: snapshots._id })
      .from(snapshots)
      .where(
        or(
          eq(snapshots.imageId, imageId),
          eq(snapshots.baselineImageId, imageId),
          eq(snapshots.diffImageId, imageId),
        ),
      )
      .limit(1),
  );
  return snapshot !== null;
}

export const cleanupEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - EVENT_RETENTION_MS;
    const events = await ctx.db
      .select({ _id: githubEvents._id })
      .from(githubEvents)
      .where(lt(githubEvents._creationTime, cutoff))
      .orderBy(asc(githubEvents._creationTime))
      .limit(DELETE_PAGE_SIZE);
    for (const event of events) {
      await ctx.db.delete(githubEvents).where(eq(githubEvents._id, event._id));
    }
    if (events.length === DELETE_PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, internal.retention.cleanupEvents, {});
    }
    return null;
  },
});
