import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { findMemberAccount, memberRole } from "./accounts.ts";
import { internal } from "./api.ts";
import { githubUserToken } from "./connections.ts";
import { first } from "./db/index.ts";
import { GithubError, isOrgOwner } from "./lib/github.ts";
import {
  accountMembers,
  accountRole,
  accounts,
  connections,
  users,
} from "./schema.ts";
import {
  AppError,
  action,
  internalMutation,
  internalQuery,
  query,
} from "./server.ts";

const MAX_MEMBERS = 200;

export async function isAccountOwner(
  githubToken: string,
  userLogin: string,
  account: { type: "user" | "org"; login: string },
): Promise<boolean> {
  if (account.type === "user") {
    return userLogin === account.login;
  }
  try {
    return await isOrgOwner(githubToken, account.login);
  } catch (error) {
    if (error instanceof GithubError && error.status === 401) {
      throw new AppError({ code: "github_token_invalid" });
    }
    throw error;
  }
}

export const list = query({
  args: { login: z.string() },
  handler: async (ctx, { login }) => {
    const account = await findMemberAccount(ctx, login);
    if (account === null) {
      return null;
    }
    const rows = await ctx.db
      .select({
        membership: accountMembers,
        login: connections.login,
        name: users.name,
        image: users.image,
        lastSeenAt: users.lastSeenAt,
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
      .where(eq(accountMembers.accountId, account._id))
      .orderBy(
        asc(accountMembers.userId),
        asc(accountMembers._creationTime),
        asc(accountMembers._id),
      )
      .limit(MAX_MEMBERS);
    const members = [];
    for (const { membership, ...user } of rows) {
      members.push({
        login: user.login,
        name: user.name,
        image: user.image,
        role: memberRole(account, user, membership),
        lastSeenAt: user.lastSeenAt,
      });
    }
    return members.sort(
      (a, b) =>
        Number(b.role === "owner") - Number(a.role === "owner") ||
        a.login.localeCompare(b.login),
    );
  },
});

export const refreshRole = action({
  args: { login: z.string() },
  handler: async (ctx, { login }): Promise<z.infer<typeof accountRole>> => {
    const { userId } = ctx;
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const target = await ctx.runQuery(internal.members.target, {
      userId,
      login,
    });
    if (target === null) {
      throw new AppError({ code: "not_found" });
    }
    const githubToken = await githubUserToken(ctx, userId);
    if (githubToken === null || target.userLogin === null) {
      throw new AppError({ code: "github_not_connected" });
    }
    const role = (await isAccountOwner(githubToken, target.userLogin, {
      type: target.accountType,
      login,
    }))
      ? "owner"
      : "member";
    await ctx.runMutation(internal.members.saveRole, {
      membershipId: target.membershipId,
      role,
    });
    return role;
  },
});

export const target = internalQuery({
  args: { userId: z.string(), login: z.string() },
  handler: async (ctx, { userId, login }) => {
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
    if (user === null) {
      return null;
    }
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.login, login))
        .orderBy(asc(accounts._creationTime), asc(accounts._id))
        .limit(1),
    );
    if (account === null) {
      return null;
    }
    const membership = first(
      await ctx.db
        .select()
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.accountId, account._id),
            eq(accountMembers.userId, userId),
          ),
        ),
    );
    if (membership === null) {
      return null;
    }
    return {
      userLogin: user.login,
      accountType: account.type,
      membershipId: membership._id,
    };
  },
});

export const saveRole = internalMutation({
  args: { membershipId: z.string(), role: accountRole },
  handler: async (ctx, { membershipId, role }) => {
    const membership = first(
      await ctx.db
        .select()
        .from(accountMembers)
        .where(eq(accountMembers._id, membershipId)),
    );
    if (membership !== null && membership.role !== role) {
      await ctx.db
        .update(accountMembers)
        .set({ role })
        .where(eq(accountMembers._id, membershipId));
    }
    return null;
  },
});
