import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  allows,
  findAllowedProject,
  findProject,
  readAccess,
  requirePermission,
} from "./lib/permissions";
import { deleteBuildRows } from "./retention";
import { repoPermission } from "./schema";

const MAX_BRANCH_PATTERNS = 20;
const MAX_BRANCH_PATTERN_LENGTH = 200;
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 365;
const DELETE_PAGE_SIZE = 500;

export const access = query({
  args: { owner: v.string(), name: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      projectId: v.id("projects"),
      owner: v.string(),
      name: v.string(),
      private: v.boolean(),
      defaultBranch: v.string(),
      permission: v.union(repoPermission, v.null()),
      fresh: v.boolean(),
      canRead: v.boolean(),
      canWrite: v.boolean(),
      canAdmin: v.boolean(),
      hasBuilds: v.boolean(),
    }),
  ),
  handler: async (ctx, { owner, name }) => {
    const project = await findProject(ctx, owner, name);
    if (project === null) {
      return null;
    }
    const access = await readAccess(ctx, project._id);
    return {
      projectId: project._id,
      owner: project.owner,
      name: project.name,
      private: project.private,
      defaultBranch: project.defaultBranch,
      permission: access.permission,
      fresh: access.fresh,
      canRead: allows(project, access, "read"),
      canWrite: allows(project, access, "write"),
      canAdmin: allows(project, access, "admin"),
      hasBuilds: project.lastBuildAt !== undefined,
    };
  },
});

export const settings = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      defaultBranch: v.string(),
      autoApproveBranches: v.array(v.string()),
      diffThreshold: v.number(),
      diffIncludeAA: v.boolean(),
      prRetentionDays: v.number(),
    }),
  ),
  handler: async (ctx, { projectId }) => {
    const project = await findAllowedProject(ctx, projectId, "admin");
    if (project === null) {
      return null;
    }
    return {
      defaultBranch: project.defaultBranch,
      autoApproveBranches: project.autoApproveBranches,
      diffThreshold: project.diffThreshold,
      diffIncludeAA: project.diffIncludeAA,
      prRetentionDays: project.prRetentionDays,
    };
  },
});

export const updateSettings = mutation({
  args: {
    projectId: v.id("projects"),
    autoApproveBranches: v.optional(v.array(v.string())),
    diffThreshold: v.optional(v.number()),
    diffIncludeAA: v.optional(v.boolean()),
    prRetentionDays: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { projectId, ...changes }) => {
    await requirePermission(ctx, projectId, "admin");
    const autoApproveBranches = changes.autoApproveBranches
      ?.map((pattern) => pattern.trim())
      .filter((pattern) => pattern !== "");
    if (
      autoApproveBranches !== undefined &&
      (autoApproveBranches.length > MAX_BRANCH_PATTERNS ||
        autoApproveBranches.some(
          (pattern) => pattern.length > MAX_BRANCH_PATTERN_LENGTH,
        ))
    ) {
      throw new ConvexError({ code: "invalid_branches" });
    }
    const { diffThreshold, prRetentionDays } = changes;
    if (
      diffThreshold !== undefined &&
      !(diffThreshold >= 0 && diffThreshold <= 1)
    ) {
      throw new ConvexError({ code: "invalid_threshold" });
    }
    if (
      prRetentionDays !== undefined &&
      !(
        Number.isInteger(prRetentionDays) &&
        prRetentionDays >= MIN_RETENTION_DAYS &&
        prRetentionDays <= MAX_RETENTION_DAYS
      )
    ) {
      throw new ConvexError({ code: "invalid_retention" });
    }
    await ctx.db.patch("projects", projectId, {
      ...changes,
      ...(autoApproveBranches === undefined ? {} : { autoApproveBranches }),
    });
    return null;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects"), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, { projectId, confirmName }) => {
    const { project } = await requirePermission(ctx, projectId, "admin");
    if (confirmName !== project.name) {
      throw new ConvexError({ code: "confirm_name_mismatch" });
    }
    await ctx.db.delete("projects", projectId);
    await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
      projectId,
    });
    return null;
  },
});

export const deleteData = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    const build = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_number", (q) => q.eq("projectId", projectId))
      .first();
    if (build !== null) {
      if (await deleteBuildRows(ctx, build._id)) {
        if (build.expiryJobId !== undefined && build.status === "pending") {
          await ctx.scheduler.cancel(build.expiryJobId);
        }
        await ctx.db.delete("builds", build._id);
      }
      await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
        projectId,
      });
      return null;
    }
    const approvals = await ctx.db
      .query("approvedImages")
      .withIndex("by_projectId_and_buildName_and_prNumber_and_imageId", (q) =>
        q.eq("projectId", projectId),
      )
      .take(DELETE_PAGE_SIZE);
    const tokens = await ctx.db
      .query("projectTokens")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(DELETE_PAGE_SIZE);
    for (const approval of approvals) {
      await ctx.db.delete("approvedImages", approval._id);
    }
    for (const token of tokens) {
      await ctx.db.delete("projectTokens", token._id);
    }
    if (
      approvals.length === DELETE_PAGE_SIZE ||
      tokens.length === DELETE_PAGE_SIZE
    ) {
      await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
        projectId,
      });
    }
    return null;
  },
});

const BACKFILL_PAGE_SIZE = 100;

export const backfillLastBuildAt = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("projects")
      .paginate({ numItems: BACKFILL_PAGE_SIZE, cursor });
    for (const project of page.page) {
      const build = await ctx.db
        .query("builds")
        .withIndex("by_projectId_and_number", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .first();
      if (build !== null && project.lastBuildAt === undefined) {
        await ctx.db.patch("projects", project._id, {
          lastBuildAt: build._creationTime,
        });
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.projects.backfillLastBuildAt, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
