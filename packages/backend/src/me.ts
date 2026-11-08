import { and, asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { toStorageUsage } from "./accounts.ts";
import { internal } from "./api.ts";
import { githubUserToken } from "./connections.ts";
import type { Id } from "./dataModel.ts";
import { syncInstallation } from "./installations.ts";
import { GithubError, listUserInstallations } from "./lib/github.ts";
import {
  accountMembers,
  accounts as accountsTable,
  projects,
} from "./schema.ts";
import { AppError, action, internalMutation, query } from "./server.ts";

const MAX_ACCOUNTS = 100;

export const accounts = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = ctx;
    if (userId === null) {
      return [];
    }
    const memberAccounts = await ctx.db
      .select({ account: accountsTable })
      .from(accountMembers)
      .innerJoin(accountsTable, eq(accountsTable._id, accountMembers.accountId))
      .where(eq(accountMembers.userId, userId))
      .orderBy(asc(accountMembers._creationTime), asc(accountMembers._id))
      .limit(MAX_ACCOUNTS);
    const projectStats =
      memberAccounts.length === 0
        ? []
        : await ctx.db
            .select({
              accountId: projects.accountId,
              projects: count(),
              lastBuildAt: max(projects.lastBuildAt),
            })
            .from(projects)
            .where(
              and(
                inArray(
                  projects.accountId,
                  memberAccounts.map(({ account }) => account._id),
                ),
                isNull(projects.archivedAt),
              ),
            )
            .groupBy(projects.accountId);
    const statsByAccount = new Map(
      projectStats.map((stats) => [stats.accountId, stats]),
    );

    const result = [];
    for (const { account } of memberAccounts) {
      const stats = statsByAccount.get(account._id);
      result.push({
        login: account.login,
        type: account.type,
        installed: account.installationId !== null,
        plan: account.plan,
        storage: toStorageUsage(account),
        projects: stats?.projects ?? 0,
        lastBuildAt: stats?.lastBuildAt ?? null,
      });
    }
    return result.sort((a, b) => a.login.localeCompare(b.login));
  },
});

export const installUrl = query({
  args: {},
  handler: async () => {
    const slug = process.env.GITHUB_APP_SLUG;
    return slug ? `https://github.com/apps/${slug}/installations/new` : null;
  },
});

export const refreshAccounts = action({
  args: {},
  handler: async (ctx) => {
    const { userId } = ctx;
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const githubToken = await githubUserToken(ctx, userId);
    if (githubToken === null) {
      throw new AppError({ code: "github_not_connected" });
    }

    let installations: Awaited<ReturnType<typeof listUserInstallations>>;
    try {
      installations = await listUserInstallations(githubToken);
    } catch (error) {
      if (error instanceof GithubError && error.status === 401) {
        throw new AppError({ code: "github_token_invalid" });
      }
      throw error;
    }

    const accountIds: Id<"accounts">[] = [];
    for (const installation of installations) {
      const accountId: Id<"accounts"> | null = await ctx.runQuery(
        internal.installations.accountIdByInstallation,
        { installationId: installation.id },
      );
      accountIds.push(
        accountId ?? (await syncInstallation(ctx, installation.id)),
      );
    }
    await ctx.runMutation(internal.me.setMemberships, { userId, accountIds });
    return null;
  },
});

export const setMemberships = internalMutation({
  args: { userId: z.string(), accountIds: z.array(z.string()) },
  handler: async (ctx, { userId, accountIds }) => {
    const keep = new Set(accountIds);
    const existing = await ctx.db
      .select()
      .from(accountMembers)
      .where(eq(accountMembers.userId, userId))
      .orderBy(asc(accountMembers._creationTime), asc(accountMembers._id))
      .limit(MAX_ACCOUNTS);
    for (const membership of existing) {
      if (keep.has(membership.accountId)) {
        keep.delete(membership.accountId);
      } else {
        await ctx.db
          .delete(accountMembers)
          .where(eq(accountMembers._id, membership._id));
      }
    }
    for (const accountId of keep) {
      await ctx.db.insert(accountMembers).values({ userId, accountId });
    }
    return null;
  },
});
