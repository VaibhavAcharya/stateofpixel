import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { allows, findProject, readAccess } from "./lib/permissions";
import { repoPermission } from "./schema";

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
    };
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
