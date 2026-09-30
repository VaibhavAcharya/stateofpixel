import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { githubUserToken } from "./connections.ts";
import { first, one } from "./db/index.ts";
import {
  GithubError,
  type GithubRepositoryPermissions,
  getRepositoryPermissions,
  isOrgOwner,
} from "./lib/github.ts";
import {
  PERMISSION_EXPIRED_AFTER_MS,
  PERMISSION_STALE_AFTER_MS,
  type RepoPermission,
} from "./lib/permissions.ts";
import {
  accounts,
  connections,
  projects,
  repoPermission,
  repoPermissions,
  users,
} from "./schema.ts";
import { AppError, action, internalMutation, internalQuery } from "./server.ts";

export const refresh = action({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    const { userId } = ctx;
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const target = await ctx.runQuery(internal.permissions.target, {
      userId,
      projectId,
    });
    if (target === null) {
      throw new AppError({ code: "not_found" });
    }
    const githubToken = await githubUserToken(ctx, userId);
    if (githubToken === null || target.userLogin === null) {
      throw new AppError({ code: "github_not_connected" });
    }

    let permission: RepoPermission;
    let orgOwner: boolean;
    try {
      permission = toRepoPermission(
        await getRepositoryPermissions(githubToken, target.owner, target.name),
      );
      orgOwner =
        target.accountType === "user"
          ? target.accountLogin === target.userLogin
          : await isOrgOwner(githubToken, target.accountLogin);
    } catch (error) {
      if (error instanceof GithubError && error.status === 401) {
        throw new AppError({ code: "github_token_invalid" });
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
  args: { userId: z.string(), projectId: z.string() },
  handler: async (ctx, { userId, projectId }) => {
    const user = first(
      await ctx.db
        .select({ login: connections.login })
        .from(users)
        .leftJoin(
          connections,
          and(
            eq(connections.userId, users._id),
            eq(connections.provider, "github"),
          ),
        )
        .where(eq(users._id, userId)),
    );
    const project = first(
      await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
    );
    if (user === null || project === null) {
      return null;
    }
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts._id, project.accountId)),
    );
    if (account === null) {
      return null;
    }
    return {
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
    userId: z.string(),
    projectId: z.string(),
    permission: repoPermission,
    orgOwner: z.boolean(),
  },
  handler: async (ctx, { userId, projectId, permission, orgOwner }) => {
    const existing = first(
      await ctx.db
        .select()
        .from(repoPermissions)
        .where(
          and(
            eq(repoPermissions.userId, userId),
            eq(repoPermissions.projectId, projectId),
          ),
        ),
    );
    if (existing !== null && existing.freshnessJobId !== null) {
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
        ? one(
            await ctx.db
              .insert(repoPermissions)
              .values({
                userId,
                projectId,
                ...fields,
              })
              .returning({ _id: repoPermissions._id }),
          )._id
        : existing._id;
    if (existing !== null) {
      await ctx.db
        .update(repoPermissions)
        .set(fields)
        .where(eq(repoPermissions._id, permissionId));
    }
    const freshnessJobId = await ctx.scheduler.runAfter(
      PERMISSION_STALE_AFTER_MS,
      internal.permissions.age,
      { permissionId, freshness: "stale" },
    );
    await ctx.db
      .update(repoPermissions)
      .set({ freshnessJobId })
      .where(eq(repoPermissions._id, permissionId));
    return null;
  },
});

export const age = internalMutation({
  args: {
    permissionId: z.string(),
    freshness: z.enum(["stale", "expired"]),
  },
  handler: async (ctx, { permissionId, freshness }) => {
    const row = first(
      await ctx.db
        .select()
        .from(repoPermissions)
        .where(eq(repoPermissions._id, permissionId)),
    );
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
        : null;
    await ctx.db
      .update(repoPermissions)
      .set({
        freshness,
        freshnessJobId,
      })
      .where(eq(repoPermissions._id, permissionId));
    return null;
  },
});
