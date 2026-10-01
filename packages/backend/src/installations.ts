import { and, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { planFields } from "./accounts.ts";
import { internal } from "./api.ts";
import type { Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import { env } from "./env.ts";
import {
  createInstallationToken,
  getInstallation,
  listInstallationRepositories,
  toRepositoryFields,
} from "./lib/github.ts";
import {
  DEFAULT_DIFF_THRESHOLD,
  DEFAULT_RETENTION_DAYS,
} from "./lib/limits.ts";
import { PLAN_STORAGE_LIMIT_BYTES } from "./lib/storage.ts";
import { accounts, projects } from "./schema.ts";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "./server.ts";

const PROJECT_CHUNK_SIZE = 200;

const repositoryFields = z.object({
  providerRepoId: z.number(),
  owner: z.string(),
  name: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
});

export const sync = internalAction({
  args: { installationId: z.number() },
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
      providerAccountId: installation.account.id,
      login: installation.account.login,
      type: installation.account.type === "Organization" ? "org" : "user",
    },
  );

  if (installation.suspended_at !== null) {
    await ctx.runMutation(internal.installations.archiveProjects, {
      accountId,
      keepProviderRepoIds: [],
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
    keepProviderRepoIds: repositories.map((repository) => repository.id),
  });
  return accountId;
}

export const accountIdByInstallation = internalQuery({
  args: { installationId: z.number() },
  handler: async (ctx, { installationId }) => {
    const account = first(
      await ctx.db
        .select({ _id: accounts._id })
        .from(accounts)
        .where(eq(accounts.installationId, installationId))
        .limit(1),
    );
    return account?._id ?? null;
  },
});

export const upsertAccount = internalMutation({
  args: {
    installationId: z.number(),
    providerAccountId: z.number(),
    login: z.string(),
    type: z.enum(["user", "org"]),
  },
  handler: async (ctx, args): Promise<Id<"accounts">> => {
    const existing = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, "github"),
            eq(accounts.providerAccountId, args.providerAccountId),
          ),
        )
        .limit(1),
    );
    const plan = env.STATEOFPIXEL_SELF_HOSTED ? "unlimited" : "free";
    if (existing !== null) {
      await ctx.db
        .update(accounts)
        .set({
          installationId: args.installationId,
          login: args.login,
          type: args.type,
          deletedAt: null,
          ...(existing.plan === "free" && plan === "unlimited"
            ? planFields(existing, plan)
            : {}),
        })
        .where(eq(accounts._id, existing._id));
      return existing._id;
    }
    const account = one(
      await ctx.db
        .insert(accounts)
        .values({
          ...args,
          plan,
          storageLimitBytes: PLAN_STORAGE_LIMIT_BYTES[plan],
          storageBytes: 0,
        })
        .returning({ _id: accounts._id }),
    );
    return account._id;
  },
});

export const upsertProjects = internalMutation({
  args: {
    accountId: z.string(),
    repositories: z.array(repositoryFields),
  },
  handler: async (ctx, { accountId, repositories }) => {
    for (const repository of repositories) {
      const existing = first(
        await ctx.db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.provider, "github"),
              eq(projects.providerRepoId, repository.providerRepoId),
            ),
          )
          .limit(1),
      );
      if (existing !== null) {
        await ctx.db
          .update(projects)
          .set({
            ...repository,
            accountId,
            archivedAt: null,
          })
          .where(eq(projects._id, existing._id));
        continue;
      }
      await ctx.db.insert(projects).values({
        ...repository,
        accountId,
        autoApproveBranches: [repository.defaultBranch],
        diffThreshold: DEFAULT_DIFF_THRESHOLD,
        diffIncludeAA: false,
        prRetentionDays: DEFAULT_RETENTION_DAYS,
        nextBuildNumber: 1,
      });
    }
    return null;
  },
});

export const archiveProjects = internalMutation({
  args: {
    accountId: z.string(),
    keepProviderRepoIds: z.array(z.number()),
  },
  handler: async (ctx, { accountId, keepProviderRepoIds }) => {
    await ctx.db
      .update(projects)
      .set({ archivedAt: Date.now() })
      .where(
        and(
          eq(projects.accountId, accountId),
          isNull(projects.archivedAt),
          keepProviderRepoIds.length === 0
            ? undefined
            : notInArray(projects.providerRepoId, keepProviderRepoIds),
        ),
      );
    return null;
  },
});

export const uninstall = internalMutation({
  args: { installationId: z.number() },
  handler: async (ctx, { installationId }) => {
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.installationId, installationId))
        .limit(1),
    );
    if (account === null) {
      return null;
    }
    await ctx.db
      .update(accounts)
      .set({ installationId: null })
      .where(eq(accounts._id, account._id));
    await internal.installations.archiveProjects.handler(ctx, {
      accountId: account._id,
      keepProviderRepoIds: [],
    });
    return null;
  },
});

export const updateRepository = internalMutation({
  args: { repository: repositoryFields },
  handler: async (ctx, { repository }) => {
    const project = first(
      await ctx.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.provider, "github"),
            eq(projects.providerRepoId, repository.providerRepoId),
          ),
        )
        .limit(1),
    );
    if (project !== null) {
      await ctx.db
        .update(projects)
        .set(repository)
        .where(eq(projects._id, project._id));
    }
    return null;
  },
});
