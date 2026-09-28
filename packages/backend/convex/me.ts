import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  env,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { syncInstallation } from "./installations";
import { GithubError, listUserInstallations } from "./lib/github";
import { plan } from "./schema";

const MAX_ACCOUNTS = 100;

export const accounts = query({
  args: {},
  returns: v.array(
    v.object({
      login: v.string(),
      type: v.union(v.literal("user"), v.literal("org")),
      installed: v.boolean(),
      plan,
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const memberships = await ctx.db
      .query("accountMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_ACCOUNTS);

    const result = [];
    for (const membership of memberships) {
      const account = await ctx.db.get("accounts", membership.accountId);
      if (account === null) {
        continue;
      }
      result.push({
        login: account.login,
        type: account.type,
        installed: account.installationId !== undefined,
        plan: account.plan,
      });
    }
    return result.sort((a, b) => a.login.localeCompare(b.login));
  },
});

export const installUrl = query({
  args: {},
  returns: v.string(),
  handler: async () =>
    `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
});

export const refreshAccounts = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }
    const githubToken: string | null = await ctx.runQuery(
      internal.me.githubToken,
      { userId },
    );
    if (githubToken === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }

    let installations: Awaited<ReturnType<typeof listUserInstallations>>;
    try {
      installations = await listUserInstallations(githubToken);
    } catch (error) {
      if (error instanceof GithubError && error.status === 401) {
        throw new ConvexError({ code: "github_token_invalid" });
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

export const githubToken = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    return user?.githubToken ?? null;
  },
});

export const setMemberships = internalMutation({
  args: { userId: v.id("users"), accountIds: v.array(v.id("accounts")) },
  returns: v.null(),
  handler: async (ctx, { userId, accountIds }) => {
    const keep = new Set(accountIds);
    const existing = await ctx.db
      .query("accountMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_ACCOUNTS);
    for (const membership of existing) {
      if (keep.has(membership.accountId)) {
        keep.delete(membership.accountId);
      } else {
        await ctx.db.delete("accountMembers", membership._id);
      }
    }
    for (const accountId of keep) {
      await ctx.db.insert("accountMembers", { userId, accountId });
    }
    return null;
  },
});
