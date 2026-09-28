import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import {
  GithubError,
  type GithubRepositoryPermissions,
  getRepositoryPermissions,
  isOrgOwner,
} from "./lib/github";
import {
  PERMISSION_EXPIRED_AFTER_MS,
  PERMISSION_STALE_AFTER_MS,
  type RepoPermission,
} from "./lib/permissions";
import { repoPermission } from "./schema";

export const refresh = action({
  args: { projectId: v.id("projects") },
  returns: repoPermission,
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }
    const target = await ctx.runQuery(internal.permissions.target, {
      userId,
      projectId,
    });
    if (target === null) {
      throw new ConvexError({ code: "not_found" });
    }

    let permission: RepoPermission;
    let orgOwner: boolean;
    try {
      permission = toRepoPermission(
        await getRepositoryPermissions(
          target.githubToken,
          target.owner,
          target.name,
        ),
      );
      orgOwner =
        target.accountType === "user"
          ? target.accountLogin === target.userLogin
          : await isOrgOwner(target.githubToken, target.accountLogin);
    } catch (error) {
      if (error instanceof GithubError && error.status === 401) {
        throw new ConvexError({ code: "github_token_invalid" });
      }
      throw error;
    }

    await ctx.runMutation(internal.permissions.save, {
      userId,
      projectId,
      permission,
      orgOwner,
    });
    return permission;
  },
});

function toRepoPermission(
  permissions: GithubRepositoryPermissions | null,
): RepoPermission {
  if (permissions === null) {
    return "none";
  }
  if (permissions.admin) {
    return "admin";
  }
  if (permissions.maintain || permissions.push) {
    return "write";
  }
  return permissions.pull ? "read" : "none";
}

export const target = internalQuery({
  args: { userId: v.id("users"), projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      githubToken: v.string(),
      userLogin: v.string(),
      owner: v.string(),
      name: v.string(),
      accountLogin: v.string(),
      accountType: v.union(v.literal("user"), v.literal("org")),
    }),
  ),
  handler: async (ctx, { userId, projectId }) => {
    const user = await ctx.db.get("users", userId);
    const project = await ctx.db.get("projects", projectId);
    if (user === null || project === null) {
      return null;
    }
    const account = await ctx.db.get("accounts", project.accountId);
    if (account === null) {
      return null;
    }
    return {
      githubToken: user.githubToken,
      userLogin: user.login,
      owner: project.owner,
      name: project.name,
      accountLogin: account.login,
      accountType: account.type,
    };
  },
});

export const save = internalMutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    permission: repoPermission,
    orgOwner: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, projectId, permission, orgOwner }) => {
    const existing = await ctx.db
      .query("repoPermissions")
      .withIndex("by_userId_and_projectId", (q) =>
        q.eq("userId", userId).eq("projectId", projectId),
      )
      .unique();
    if (existing?.freshnessJobId !== undefined) {
      await ctx.scheduler.cancel(existing.freshnessJobId);
    }
    const fields = {
      permission,
      orgOwner,
      checkedAt: Date.now(),
      freshness: "fresh" as const,
    };
    const permissionId =
      existing === null
        ? await ctx.db.insert("repoPermissions", {
            userId,
            projectId,
            ...fields,
          })
        : existing._id;
    if (existing !== null) {
      await ctx.db.patch("repoPermissions", permissionId, fields);
    }
    const freshnessJobId = await ctx.scheduler.runAfter(
      PERMISSION_STALE_AFTER_MS,
      internal.permissions.age,
      { permissionId, freshness: "stale" },
    );
    await ctx.db.patch("repoPermissions", permissionId, { freshnessJobId });
    return null;
  },
});

export const age = internalMutation({
  args: {
    permissionId: v.id("repoPermissions"),
    freshness: v.union(v.literal("stale"), v.literal("expired")),
  },
  returns: v.null(),
  handler: async (ctx, { permissionId, freshness }) => {
    const row = await ctx.db.get("repoPermissions", permissionId);
    if (row === null) {
      return null;
    }
    const freshnessJobId =
      freshness === "stale"
        ? await ctx.scheduler.runAfter(
            PERMISSION_EXPIRED_AFTER_MS - PERMISSION_STALE_AFTER_MS,
            internal.permissions.age,
            { permissionId, freshness: "expired" },
          )
        : undefined;
    await ctx.db.patch("repoPermissions", permissionId, {
      freshness,
      freshnessJobId,
    });
    return null;
  },
});
