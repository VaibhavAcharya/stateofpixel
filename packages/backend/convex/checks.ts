import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { toStatus } from "./lib/checkStatus";
import {
  createCommitStatus,
  createInstallationToken,
  GithubError,
} from "./lib/github";
import { buildUrl } from "./lib/urls";
import { DEFAULT_BUILD_NAME } from "./schema";

const SYNC_STALE_MS = 5 * 60 * 1000;
const RETRY_BATCH = 100;

export async function touchCheck(ctx: MutationCtx, buildId: Id<"builds">) {
  const build = await ctx.db.get("builds", buildId);
  if (build === null) {
    return;
  }
  const now = Date.now();
  const scheduled =
    build.checkSyncScheduledAt !== undefined &&
    now - build.checkSyncScheduledAt < SYNC_STALE_MS;
  await ctx.db.patch("builds", buildId, {
    checkVersion: build.checkVersion + 1,
    checkOutOfSync: true,
    ...(scheduled ? {} : { checkSyncScheduledAt: now }),
  });
  if (!scheduled) {
    await ctx.scheduler.runAfter(0, internal.checks.sync, { buildId });
  }
}

export const sync = internalAction({
  args: { buildId: v.id("builds") },
  returns: v.null(),
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

const statusFields = v.object({
  state: v.union(
    v.literal("pending"),
    v.literal("success"),
    v.literal("failure"),
    v.literal("error"),
  ),
  target_url: v.string(),
  description: v.string(),
  context: v.string(),
});

export const state = internalQuery({
  args: { buildId: v.id("builds") },
  returns: v.union(
    v.null(),
    v.object({
      version: v.number(),
      commitSha: v.string(),
      repository: v.union(
        v.null(),
        v.object({
          installationId: v.number(),
          owner: v.string(),
          name: v.string(),
        }),
      ),
      fields: statusFields,
    }),
  ),
  handler: async (ctx, { buildId }) => {
    const build = await ctx.db.get("builds", buildId);
    const project =
      build === null ? null : await ctx.db.get("projects", build.projectId);
    if (build === null || project === null) {
      return null;
    }
    const account = await ctx.db.get("accounts", project.accountId);
    const url = buildUrl(project, build.number);

    return {
      version: build.checkVersion,
      commitSha: build.commitSha,
      repository:
        account?.installationId === undefined ||
        project.archivedAt !== undefined
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
    buildId: v.id("builds"),
    version: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, version }) => {
    const build = await ctx.db.get("builds", buildId);
    if (build === null) {
      return null;
    }
    const synced = version === build.checkVersion;
    const resync = !synced && version !== null;
    await ctx.db.patch("builds", buildId, {
      checkOutOfSync: !synced,
      checkSyncScheduledAt: resync ? Date.now() : undefined,
    });
    if (resync) {
      await ctx.scheduler.runAfter(0, internal.checks.sync, { buildId });
    }
    return null;
  },
});

export const retryOutOfSync = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_checkOutOfSync", (q) => q.eq("checkOutOfSync", true))
      .take(RETRY_BATCH);
    for (const build of builds) {
      if (
        build.checkSyncScheduledAt === undefined ||
        now - build.checkSyncScheduledAt >= SYNC_STALE_MS
      ) {
        await ctx.db.patch("builds", build._id, { checkSyncScheduledAt: now });
        await ctx.scheduler.runAfter(0, internal.checks.sync, {
          buildId: build._id,
        });
      }
    }
    return null;
  },
});
