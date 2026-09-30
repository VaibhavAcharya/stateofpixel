import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { toStatus } from "./lib/checkStatus.ts";
import {
  createCommitStatus,
  createInstallationToken,
  GithubError,
} from "./lib/github.ts";
import { buildUrl } from "./lib/urls.ts";
import { accounts, builds, DEFAULT_BUILD_NAME, projects } from "./schema.ts";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./server.ts";

const SYNC_STALE_MS = 5 * 60 * 1000;
const RETRY_BATCH = 100;

async function getBuild(
  ctx: QueryCtx,
  buildId: Id<"builds">,
): Promise<Doc<"builds"> | null> {
  return first(
    await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
  );
}

export async function touchCheck(ctx: MutationCtx, buildId: Id<"builds">) {
  const build = await getBuild(ctx, buildId);
  if (build === null) {
    return;
  }
  const now = Date.now();
  const scheduled =
    build.checkSyncScheduledAt !== null &&
    now - build.checkSyncScheduledAt < SYNC_STALE_MS;
  await ctx.db
    .update(builds)
    .set({
      checkVersion: build.checkVersion + 1,
      checkOutOfSync: true,
      ...(scheduled ? {} : { checkSyncScheduledAt: now }),
    })
    .where(eq(builds._id, buildId));
  if (!scheduled) {
    await ctx.scheduler.runAfter(0, internal.checks.sync, { buildId });
  }
}

export const sync = internalAction({
  args: { buildId: z.string() },
  handler: async (ctx, { buildId }) => {
    const state = await ctx.runQuery(internal.checks.state, { buildId });
    if (state === null) {
      return null;
    }
    try {
      if (state.repository !== null) {
        const token = await createInstallationToken(
          state.repository.installationId,
        );
        const { owner, name } = state.repository;
        await createCommitStatus(
          token,
          owner,
          name,
          state.commitSha,
          state.fields,
        );
      }
    } catch (error) {
      const rejected = error instanceof GithubError && error.status === 422;
      await ctx.runMutation(internal.checks.markSynced, {
        buildId,
        version: rejected ? state.version : null,
      });
      throw error;
    }
    await ctx.runMutation(internal.checks.markSynced, {
      buildId,
      version: state.version,
    });
    return null;
  },
});

export const state = internalQuery({
  args: { buildId: z.string() },
  handler: async (ctx, { buildId }) => {
    const build = await getBuild(ctx, buildId);
    const project =
      build === null
        ? null
        : first(
            await ctx.db
              .select()
              .from(projects)
              .where(eq(projects._id, build.projectId)),
          );
    if (build === null || project === null) {
      return null;
    }
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts._id, project.accountId)),
    );
    const url = buildUrl(project, build.number);

    return {
      version: build.checkVersion,
      commitSha: build.commitSha,
      repository:
        account === null ||
        account.installationId === null ||
        project.archivedAt !== null
          ? null
          : {
              installationId: account.installationId,
              owner: project.owner,
              name: project.name,
            },
      fields: {
        ...toStatus(build),
        target_url: url,
        context:
          build.buildName === DEFAULT_BUILD_NAME
            ? "stateofpixel"
            : `stateofpixel/${build.buildName}`,
      },
    };
  },
});

export const markSynced = internalMutation({
  args: {
    buildId: z.string(),
    version: z.number().nullable(),
  },
  handler: async (ctx, { buildId, version }) => {
    const build = await getBuild(ctx, buildId);
    if (build === null) {
      return null;
    }
    const synced = version === build.checkVersion;
    const resync = !synced && version !== null;
    await ctx.db
      .update(builds)
      .set({
        checkOutOfSync: !synced,
        checkSyncScheduledAt: resync ? Date.now() : null,
      })
      .where(eq(builds._id, buildId));
    if (resync) {
      await ctx.scheduler.runAfter(0, internal.checks.sync, { buildId });
    }
    return null;
  },
});

export const retryOutOfSync = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const outOfSync = await ctx.db
      .select()
      .from(builds)
      .where(eq(builds.checkOutOfSync, true))
      .orderBy(asc(builds._creationTime), asc(builds._id))
      .limit(RETRY_BATCH);
    for (const build of outOfSync) {
      if (
        build.checkSyncScheduledAt === null ||
        now - build.checkSyncScheduledAt >= SYNC_STALE_MS
      ) {
        await ctx.db
          .update(builds)
          .set({ checkSyncScheduledAt: now })
          .where(eq(builds._id, build._id));
        await ctx.scheduler.runAfter(0, internal.checks.sync, {
          buildId: build._id,
        });
      }
    }
    return null;
  },
});
