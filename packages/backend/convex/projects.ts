import { v } from "convex/values";
import { query } from "./_generated/server";
import { allows, readAccess } from "./lib/permissions";
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
    const project = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_name", (q) =>
        q.eq("owner", owner).eq("name", name),
      )
      .first();
    if (project === null || project.archivedAt !== undefined) {
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
