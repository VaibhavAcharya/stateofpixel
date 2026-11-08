import { and, asc, count, desc, eq, inArray, isNull, max } from "drizzle-orm";
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
  connections,
  projects,
  users,
} from "./schema.ts";
import {
  AppError,
  action,
  internalMutation,
  type QueryCtx,
  query,
} from "./server.ts";

const MAX_ACCOUNTS = 100;

const MAX_FACES = 4;

async function accountMemberFaces(ctx: QueryCtx, accountIds: string[]) {
  const result = new Map<
    string,
    { count: number; faces: { login: string; image: string | null }[] }
  >();
  if (accountIds.length === 0) {
    return result;
  }
  const counts = await ctx.db
    .select({ accountId: accountMembers.accountId, count: count() })
    .from(accountMembers)
    .where(inArray(accountMembers.accountId, accountIds))
    .groupBy(accountMembers.accountId);
  for (const row of counts) {
    result.set(row.accountId, { count: row.count, faces: [] });
  }
  const rows = await ctx.db
    .select({
      accountId: accountMembers.accountId,
      login: connections.login,
      image: users.image,
    })
    .from(accountMembers)
    .innerJoin(users, eq(users._id, accountMembers.userId))
    .innerJoin(
      connections,
      and(
        eq(connections.userId, users._id),
        eq(connections.provider, "github"),
      ),
    )
    .where(inArray(accountMembers.accountId, accountIds))
    .orderBy(desc(users.lastSeenAt), asc(accountMembers._id))
    .limit(MAX_ACCOUNTS * MAX_FACES * 10);
  for (const { accountId, ...face } of rows) {
    const entry = result.get(accountId);
    if (entry !== undefined && entry.faces.length < MAX_FACES) {
      entry.faces.push(face);
    }
  }
  return result;
}

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
    const membersByAccount = await accountMemberFaces(
      ctx,
      memberAccounts.map(({ account }) => account._id),
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
        members: membersByAccount.get(account._id) ?? { count: 0, faces: [] },
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
