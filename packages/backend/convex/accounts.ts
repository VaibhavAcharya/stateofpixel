import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type QueryCtx, query } from "./_generated/server";
import { PLAN_STORAGE_LIMIT_BYTES, withStorageBytes } from "./lib/storage";
import {
  buildConclusion,
  buildCounts,
  buildStatus,
  plan,
  storageUsage,
} from "./schema";

const projectRow = v.object({
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
      storageBlocked: v.boolean(),
      createdAt: v.number(),
    }),
  ),
});

async function toProjectRow(
  ctx: QueryCtx,
  project: Doc<"projects">,
): Promise<Infer<typeof projectRow>> {
  const build = await ctx.db
    .query("builds")
    .withIndex("by_projectId_and_number", (q) => q.eq("projectId", project._id))
    .order("desc")
    .first();
  return {
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
            storageBlocked: build.storageBlocked,
            createdAt: build._creationTime,
          },
  };
}

async function findMemberAccount(ctx: QueryCtx, login: string) {
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
  return membership === null ? null : account;
}

export const home = query({
  args: { login: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      login: v.string(),
      type: v.union(v.literal("user"), v.literal("org")),
      installationSettingsUrl: v.union(v.string(), v.null()),
      storage: storageUsage,
      subscribed: v.boolean(),
      billingCustomer: v.boolean(),
    }),
  ),
  handler: async (ctx, { login }) => {
    const account = await findMemberAccount(ctx, login);
    if (account === null) {
      return null;
    }
    return {
      login: account.login,
      type: account.type,
      installationSettingsUrl:
        account.installationId === undefined
          ? null
          : account.type === "org"
            ? `https://github.com/organizations/${account.login}/settings/installations/${account.installationId}`
            : `https://github.com/settings/installations/${account.installationId}`,
      storage: toStorageUsage(account),
      subscribed: account.billingSubscriptionId !== undefined,
      billingCustomer: account.billingCustomerId !== undefined,
    };
  },
});

export function toStorageUsage(
  account: Doc<"accounts">,
): Infer<typeof storageUsage> {
  return {
    plan: account.plan,
    storageBytes: account.storageBytes,
    storageLimitBytes: account.storageLimitBytes,
    overLimitSince: account.overLimitSince,
  };
}

export const setPlan = internalMutation({
  args: {
    login: v.string(),
    plan,
    storageLimitBytes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_login", (q) => q.eq("login", args.login))
      .first();
    if (account === null) {
      throw new Error(`No account ${args.login}`);
    }
    const storageLimitBytes =
      args.plan === "custom"
        ? args.storageLimitBytes
        : PLAN_STORAGE_LIMIT_BYTES[args.plan];
    if (storageLimitBytes === undefined) {
      throw new Error("A custom plan needs storageLimitBytes");
    }
    await ctx.db.patch(
      "accounts",
      account._id,
      planFields(account, args.plan, storageLimitBytes),
    );
    return null;
  },
});

export function planFields(
  account: Doc<"accounts">,
  plan: Doc<"accounts">["plan"],
  storageLimitBytes: number = PLAN_STORAGE_LIMIT_BYTES[
    plan as keyof typeof PLAN_STORAGE_LIMIT_BYTES
  ],
) {
  return {
    plan,
    storageLimitBytes,
    ...withStorageBytes(
      { ...account, storageLimitBytes },
      account.storageBytes,
      Date.now(),
    ),
  };
}

export const projects = query({
  args: {
    login: v.string(),
    search: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("name"), v.literal("updated"))),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(projectRow),
  handler: async (ctx, args) => {
    const account = await findMemberAccount(ctx, args.login);
    if (account === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const projects = ctx.db.query("projects");
    const search = args.search?.trim() ?? "";
    const ordered =
      search !== ""
        ? projects.withSearchIndex("search_name", (q) =>
            q.search("name", search).eq("accountId", account._id),
          )
        : args.sort === "updated"
          ? projects
              .withIndex("by_accountId_and_lastBuildAt", (q) =>
                q.eq("accountId", account._id),
              )
              .order(args.order ?? "desc")
          : projects
              .withIndex("by_accountId_and_name", (q) =>
                q.eq("accountId", account._id),
              )
              .order(args.order ?? "asc");
    const page = await ordered
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .paginate(args.paginationOpts);
    const rows = [];
    for (const project of page.page) {
      rows.push(await toProjectRow(ctx, project));
    }
    return { ...page, page: rows };
  },
});
