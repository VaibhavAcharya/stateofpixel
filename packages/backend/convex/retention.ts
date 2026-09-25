import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { deleteImage } from "./blobs";
import { matchesBranch } from "./lib/matchesBranch";
import { withStorageBytes } from "./lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_GRACE_MS = DAY_MS;
const EVENT_RETENTION_MS = 7 * DAY_MS;
const SCAN_PAGE_SIZE = 100;
const DELETE_PAGE_SIZE = 500;
const MAX_PR_BUILDS = 1000;

export const setPrClosed = internalMutation({
  args: {
    githubRepoId: v.number(),
    prNumber: v.number(),
    closed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { githubRepoId, prNumber, closed }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_githubRepoId", (q) => q.eq("githubRepoId", githubRepoId))
      .unique();
    if (project === null) {
      return null;
    }
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_prNumber", (q) =>
        q.eq("projectId", project._id).eq("prNumber", prNumber),
      )
      .take(MAX_PR_BUILDS);
    const prClosedAt = closed ? Date.now() : undefined;
    for (const build of builds) {
      await ctx.db.patch("builds", build._id, { prClosedAt });
    }
    return null;
  },
});

export const deleteOldBuilds = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const page = await ctx.db
      .query("builds")
      .order("desc")
      .paginate({ numItems: SCAN_PAGE_SIZE, cursor: args.cursor ?? null });
    const projects = new Map<Id<"projects">, Doc<"projects"> | null>();
    for (const build of page.page) {
      if (!projects.has(build.projectId)) {
        projects.set(
          build.projectId,
          await ctx.db.get("projects", build.projectId),
        );
      }
      const project = projects.get(build.projectId) ?? null;
      if (
        project !== null &&
        (await isPastRetention(ctx, project, build, startedAt))
      ) {
        await ctx.db.delete("builds", build._id);
        await ctx.scheduler.runAfter(0, internal.retention.deleteBuildData, {
          buildId: build._id,
        });
        if (build.prNumber !== undefined) {
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

async function isPastRetention(
  ctx: QueryCtx,
  project: Doc<"projects">,
  build: Doc<"builds">,
  now: number,
): Promise<boolean> {
  if (
    build.status === "pending" ||
    build.branch === project.defaultBranch ||
    project.autoApproveBranches.some((pattern) =>
      matchesBranch(pattern, build.branch),
    )
  ) {
    return false;
  }
  const cutoff = now - project.prRetentionDays * DAY_MS;
  const lastOnBranch = await ctx.db
    .query("builds")
    .withIndex("by_projectId_and_branch", (q) =>
      q.eq("projectId", build.projectId).eq("branch", build.branch),
    )
    .order("desc")
    .first();
  const expired =
    (build.prClosedAt !== undefined && build.prClosedAt < cutoff) ||
    (lastOnBranch?._creationTime ?? build._creationTime) < cutoff;
  if (!expired) {
    return false;
  }
  const usedAsBaseline = await ctx.db
    .query("builds")
    .withIndex("by_baselineBuildId", (q) => q.eq("baselineBuildId", build._id))
    .first();
  return usedAsBaseline === null;
}

export const deleteBuildData = internalMutation({
  args: { buildId: v.id("builds") },
  returns: v.null(),
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
  const snapshots = await ctx.db
    .query("snapshots")
    .withIndex("by_buildId_and_name", (q) => q.eq("buildId", buildId))
    .take(DELETE_PAGE_SIZE);
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .take(DELETE_PAGE_SIZE);
  for (const snapshot of snapshots) {
    await ctx.db.delete("snapshots", snapshot._id);
  }
  for (const review of reviews) {
    await ctx.db.delete("reviews", review._id);
  }
  return (
    snapshots.length < DELETE_PAGE_SIZE && reviews.length < DELETE_PAGE_SIZE
  );
}

export const deleteApprovals = internalMutation({
  args: {
    projectId: v.id("projects"),
    buildName: v.string(),
    prNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const remainingBuild = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_buildName_and_prNumber", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("buildName", args.buildName)
          .eq("prNumber", args.prNumber),
      )
      .first();
    if (remainingBuild !== null) {
      return null;
    }
    const approvals = await ctx.db
      .query("approvedImages")
      .withIndex("by_projectId_and_buildName_and_prNumber_and_imageId", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("buildName", args.buildName)
          .eq("prNumber", args.prNumber),
      )
      .take(DELETE_PAGE_SIZE);
    for (const approval of approvals) {
      await ctx.db.delete("approvedImages", approval._id);
    }
    if (approvals.length === DELETE_PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, internal.retention.deleteApprovals, args);
    }
    return null;
  },
});

export const collectImages = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const page = await ctx.db
      .query("images")
      .paginate({ numItems: SCAN_PAGE_SIZE, cursor: args.cursor ?? null });
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
      const account = await ctx.db.get("accounts", accountId);
      if (account !== null) {
        await ctx.db.patch(
          "accounts",
          accountId,
          withStorageBytes(
            account,
            Math.max(0, account.storageBytes - bytes),
            Date.now(),
          ),
        );
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
  return (
    (await ctx.db
      .query("snapshots")
      .withIndex("by_imageId", (q) => q.eq("imageId", imageId))
      .first()) !== null ||
    (await ctx.db
      .query("snapshots")
      .withIndex("by_baselineImageId", (q) => q.eq("baselineImageId", imageId))
      .first()) !== null ||
    (await ctx.db
      .query("snapshots")
      .withIndex("by_diffImageId", (q) => q.eq("diffImageId", imageId))
      .first()) !== null
  );
}

export const cleanupEvents = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - EVENT_RETENTION_MS;
    const events = await ctx.db
      .query("githubEvents")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(DELETE_PAGE_SIZE);
    for (const event of events) {
      await ctx.db.delete("githubEvents", event._id);
    }
    if (events.length === DELETE_PAGE_SIZE) {
      await ctx.scheduler.runAfter(0, internal.retention.cleanupEvents, {});
    }
    return null;
  },
});
