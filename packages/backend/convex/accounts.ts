import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { buildConclusion, buildCounts, buildStatus } from "./schema";

const MAX_PROJECTS = 100;

export const home = query({
  args: { login: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      login: v.string(),
      type: v.union(v.literal("user"), v.literal("org")),
      installationSettingsUrl: v.union(v.string(), v.null()),
      projects: v.array(
        v.object({
          owner: v.string(),
          name: v.string(),
          private: v.boolean(),
          latestBuild: v.union(
            v.null(),
            v.object({
              number: v.number(),
              branch: v.string(),
              status: buildStatus,
              conclusion: v.union(buildConclusion, v.null()),
              counts: buildCounts,
              createdAt: v.number(),
            }),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, { login }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_login", (q) => q.eq("login", login))
      .first();
    if (account === null) {
      return null;
    }
    const membership = await ctx.db
      .query("accountMembers")
      .withIndex("by_accountId_and_userId", (q) =>
        q.eq("accountId", account._id).eq("userId", userId),
      )
      .unique();
    if (membership === null) {
      return null;
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_accountId", (q) => q.eq("accountId", account._id))
      .take(MAX_PROJECTS);
    const rows = [];
    for (const project of projects) {
      if (project.archivedAt !== undefined) {
        continue;
      }
      const build = await ctx.db
        .query("builds")
        .withIndex("by_projectId_and_number", (q) =>
          q.eq("projectId", project._id),
        )
        .order("desc")
        .first();
      rows.push({
        owner: project.owner,
        name: project.name,
        private: project.private,
        latestBuild:
          build === null
            ? null
            : {
                number: build.number,
                branch: build.branch,
                status: build.status,
                conclusion: build.conclusion ?? null,
                counts: build.counts,
                createdAt: build._creationTime,
              },
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    return {
      login: account.login,
      type: account.type,
      installationSettingsUrl:
        account.installationId === undefined
          ? null
          : account.type === "org"
            ? `https://github.com/organizations/${account.login}/settings/installations/${account.installationId}`
            : `https://github.com/settings/installations/${account.installationId}`,
      projects: rows,
    };
  },
});
