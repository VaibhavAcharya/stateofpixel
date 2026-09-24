import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  createInstallationToken,
  getInstallation,
  listInstallationRepositories,
  toRepositoryFields,
} from "./lib/github";

const FREE_STORAGE_LIMIT_BYTES = 25 * 1024 ** 3;
const PROJECT_CHUNK_SIZE = 200;

const repositoryFields = v.object({
  githubRepoId: v.number(),
  owner: v.string(),
  name: v.string(),
  private: v.boolean(),
  defaultBranch: v.string(),
});

export const sync = internalAction({
  args: { installationId: v.number() },
  returns: v.null(),
  handler: async (ctx, { installationId }) => {
    await syncInstallation(ctx, installationId);
    return null;
  },
});

export async function syncInstallation(
  ctx: ActionCtx,
  installationId: number,
): Promise<Id<"accounts">> {
  const installation = await getInstallation(installationId);
  const accountId: Id<"accounts"> = await ctx.runMutation(
    internal.installations.upsertAccount,
    {
      installationId,
      githubAccountId: installation.account.id,
      login: installation.account.login,
      type: installation.account.type === "Organization" ? "org" : "user",
    },
  );

  if (installation.suspended_at !== null) {
    await ctx.runMutation(internal.installations.archiveProjects, {
      accountId,
      keepGithubRepoIds: [],
    });
    return accountId;
  }

  const repositories = await listInstallationRepositories(
    await createInstallationToken(installationId),
  );
  for (let i = 0; i < repositories.length; i += PROJECT_CHUNK_SIZE) {
    await ctx.runMutation(internal.installations.upsertProjects, {
      accountId,
      repositories: repositories
        .slice(i, i + PROJECT_CHUNK_SIZE)
        .map(toRepositoryFields),
    });
  }
  await ctx.runMutation(internal.installations.archiveProjects, {
    accountId,
    keepGithubRepoIds: repositories.map((repository) => repository.id),
  });
  return accountId;
}

export const accountIdByInstallation = internalQuery({
  args: { installationId: v.number() },
  returns: v.union(v.id("accounts"), v.null()),
  handler: async (ctx, { installationId }) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId),
      )
      .unique();
    return account?._id ?? null;
  },
});

export const upsertAccount = internalMutation({
  args: {
    installationId: v.number(),
    githubAccountId: v.number(),
    login: v.string(),
    type: v.union(v.literal("user"), v.literal("org")),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_githubAccountId", (q) =>
        q.eq("githubAccountId", args.githubAccountId),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch("accounts", existing._id, {
        installationId: args.installationId,
        login: args.login,
        type: args.type,
        deletedAt: undefined,
      });
      return existing._id;
    }
    return ctx.db.insert("accounts", {
      ...args,
      plan: "free",
      storageLimitBytes: FREE_STORAGE_LIMIT_BYTES,
      storageBytes: 0,
    });
  },
});

export const upsertProjects = internalMutation({
  args: {
    accountId: v.id("accounts"),
    repositories: v.array(repositoryFields),
  },
  returns: v.null(),
  handler: async (ctx, { accountId, repositories }) => {
    for (const repository of repositories) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_githubRepoId", (q) =>
          q.eq("githubRepoId", repository.githubRepoId),
        )
        .unique();
      if (existing !== null) {
        await ctx.db.patch("projects", existing._id, {
          ...repository,
          accountId,
          archivedAt: undefined,
        });
        continue;
      }
      await ctx.db.insert("projects", {
        ...repository,
        accountId,
        autoApproveBranches: [repository.defaultBranch],
        diffThreshold: 0.1,
        diffIncludeAA: false,
        prRetentionDays: 30,
        nextBuildNumber: 1,
      });
    }
    return null;
  },
});

export const archiveProjects = internalMutation({
  args: {
    accountId: v.id("accounts"),
    keepGithubRepoIds: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { accountId, keepGithubRepoIds }) => {
    const keep = new Set(keepGithubRepoIds);
    const now = Date.now();
    for await (const project of ctx.db
      .query("projects")
      .withIndex("by_accountId", (q) => q.eq("accountId", accountId))) {
      if (!keep.has(project.githubRepoId) && project.archivedAt === undefined) {
        await ctx.db.patch("projects", project._id, { archivedAt: now });
      }
    }
    return null;
  },
});

export const uninstall = internalMutation({
  args: { installationId: v.number() },
  returns: v.null(),
  handler: async (ctx, { installationId }) => {
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId),
      )
      .unique();
    if (account === null) {
      return null;
    }
    await ctx.db.patch("accounts", account._id, { installationId: undefined });
    await ctx.runMutation(internal.installations.archiveProjects, {
      accountId: account._id,
      keepGithubRepoIds: [],
    });
    return null;
  },
});

export const updateRepository = internalMutation({
  args: { repository: repositoryFields },
  returns: v.null(),
  handler: async (ctx, { repository }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_githubRepoId", (q) =>
        q.eq("githubRepoId", repository.githubRepoId),
      )
      .unique();
    if (project !== null) {
      await ctx.db.patch("projects", project._id, repository);
    }
    return null;
  },
});
