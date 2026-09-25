import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { findMemberAccount, memberRole } from "./accounts";
import { GithubError, isOrgOwner } from "./lib/github";
import { accountRole } from "./schema";

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
      throw new ConvexError({ code: "github_token_invalid" });
    }
    throw error;
  }
}

export const list = query({
  args: { login: v.string() },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        login: v.string(),
        name: v.union(v.string(), v.null()),
        image: v.union(v.string(), v.null()),
        role: v.union(accountRole, v.null()),
        lastSeenAt: v.number(),
      }),
    ),
  ),
  handler: async (ctx, { login }) => {
    const account = await findMemberAccount(ctx, login);
    if (account === null) {
      return null;
    }
    const memberships = await ctx.db
      .query("accountMembers")
      .withIndex("by_accountId_and_userId", (q) =>
        q.eq("accountId", account._id),
      )
      .take(MAX_MEMBERS);
    const members = [];
    for (const membership of memberships) {
      const user = await ctx.db.get("users", membership.userId);
      if (user === null) {
        continue;
      }
      members.push({
        login: user.login,
        name: user.name ?? null,
        image: user.image ?? null,
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
  args: { login: v.string() },
  returns: accountRole,
  handler: async (ctx, { login }): Promise<Infer<typeof accountRole>> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }
    const target = await ctx.runQuery(internal.members.target, {
      userId,
      login,
    });
    if (target === null) {
      throw new ConvexError({ code: "not_found" });
    }
    const role = (await isAccountOwner(target.githubToken, target.userLogin, {
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
  args: { userId: v.id("users"), login: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      githubToken: v.string(),
      userLogin: v.string(),
      accountType: v.union(v.literal("user"), v.literal("org")),
      membershipId: v.id("accountMembers"),
    }),
  ),
  handler: async (ctx, { userId, login }) => {
    const user = await ctx.db.get("users", userId);
    if (user === null) {
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
    return {
      githubToken: user.githubToken,
      userLogin: user.login,
      accountType: account.type,
      membershipId: membership._id,
    };
  },
});

export const saveRole = internalMutation({
  args: { membershipId: v.id("accountMembers"), role: accountRole },
  returns: v.null(),
  handler: async (ctx, { membershipId, role }) => {
    const membership = await ctx.db.get("accountMembers", membershipId);
    if (membership !== null && membership.role !== role) {
      await ctx.db.patch("accountMembers", membershipId, { role });
    }
    return null;
  },
});
