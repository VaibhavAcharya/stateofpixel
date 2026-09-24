import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import {
  type CheckRunFields,
  createCheckRun,
  createInstallationToken,
  updateCheckRun,
} from "./lib/github";
import { buildUrl } from "./lib/urls";

const SYNC_STALE_MS = 5 * 60 * 1000;
const MAX_LINKED_SNAPSHOTS = 10;
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
    let checkRunId = state.checkRunId;
    try {
      if (state.repository !== null) {
        const token = await createInstallationToken(
          state.repository.installationId,
        );
        const { owner, name } = state.repository;
        if (checkRunId === null) {
          checkRunId = await createCheckRun(token, owner, name, {
            name: state.checkName,
            head_sha: state.commitSha,
            external_id: buildId,
            ...state.fields,
          });
        } else {
          await updateCheckRun(token, owner, name, checkRunId, state.fields);
        }
      }
    } catch (error) {
      await ctx.runMutation(internal.checks.markSynced, {
        buildId,
        version: null,
        checkRunId,
      });
      throw error;
    }
    await ctx.runMutation(internal.checks.markSynced, {
      buildId,
      version: state.version,
      checkRunId,
    });
    return null;
  },
});

const checkFields = v.object({
  status: v.union(v.literal("in_progress"), v.literal("completed")),
  conclusion: v.optional(
    v.union(
      v.literal("success"),
      v.literal("action_required"),
      v.literal("failure"),
      v.literal("timed_out"),
      v.literal("neutral"),
    ),
  ),
  details_url: v.string(),
  output: v.object({ title: v.string(), summary: v.string() }),
});

export const state = internalQuery({
  args: { buildId: v.id("builds") },
  returns: v.union(
    v.null(),
    v.object({
      version: v.number(),
      checkRunId: v.union(v.number(), v.null()),
      checkName: v.string(),
      commitSha: v.string(),
      repository: v.union(
        v.null(),
        v.object({
          installationId: v.number(),
          owner: v.string(),
          name: v.string(),
        }),
      ),
      fields: checkFields,
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

    const linked: Doc<"snapshots">[] = [];
    for (const diffStatus of ["changed", "added"] as const) {
      linked.push(
        ...(await ctx.db
          .query("snapshots")
          .withIndex("by_buildId_and_diffStatus_and_name", (q) =>
            q.eq("buildId", buildId).eq("diffStatus", diffStatus),
          )
          .take(MAX_LINKED_SNAPSHOTS - linked.length)),
      );
    }

    return {
      version: build.checkVersion,
      checkRunId: build.githubCheckRunId ?? null,
      checkName:
        build.buildName === "default"
          ? "stateofpixel"
          : `stateofpixel/${build.buildName}`,
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
      fields: toCheckFields(build, url, linked),
    };
  },
});

export function toCheckFields(
  build: Doc<"builds">,
  url: string,
  linked: Doc<"snapshots">[],
): CheckRunFields {
  const { counts } = build;
  const changes = counts.changed + counts.added;
  const summary = [
    "| Unchanged | Changed | Added | Removed | Failed |",
    "|---|---|---|---|---|",
    `| ${[counts.unchanged, counts.changed, counts.added, counts.removed, counts.failed].map(formatCount).join(" | ")} |`,
    "",
    `[Open build #${build.number}](${url})`,
    ...(linked.length === 0
      ? []
      : [
          "",
          ...linked.map(
            (snapshot) =>
              `- ${snapshot.diffStatus}: [${escapeMarkdown(snapshot.name)}](${url}/snapshots/${snapshot._id})`,
          ),
        ]),
  ].join("\n");
  const completed = (
    conclusion: NonNullable<CheckRunFields["conclusion"]>,
    title: string,
  ): CheckRunFields => ({
    status: "completed",
    conclusion,
    details_url: url,
    output: { title, summary },
  });

  if (build.status === "pending") {
    const shards =
      build.shardsTotal === undefined || build.shardsTotal === 1
        ? ""
        : ` (${build.doneShardIndexes.length} of ${build.shardsTotal} shards)`;
    return {
      status: "in_progress",
      details_url: url,
      output: { title: `Waiting for screenshots${shards}`, summary },
    };
  }
  if (build.status === "expired") {
    return completed("timed_out", "Build never finished");
  }
  if (build.status === "error") {
    return completed("failure", "Upload failed, see CI logs");
  }
  switch (build.conclusion) {
    case "no_changes":
      return completed("success", "No visual changes");
    case "approved":
      if (build.baselineBuildId === undefined) {
        return completed(
          "success",
          `Baseline created, ${plural(counts.added, "snapshot")}`,
        );
      }
      return completed(
        "success",
        build.autoApproved
          ? `Baseline updated, ${plural(changes, "change")}`
          : `${plural(changes, "change")} approved`,
      );
    case "rejected":
      return completed(
        "failure",
        `${plural(counts.rejected, "change")} rejected`,
      );
    default:
      return completed(
        "action_required",
        counts.failed > 0
          ? `${plural(counts.pending, "change")} to review, ${formatCount(counts.failed)} failed`
          : `${plural(counts.pending, "change")} to review`,
      );
  }
}

function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\[\]()*_`|])/g, "\\$1");
}

export const markSynced = internalMutation({
  args: {
    buildId: v.id("builds"),
    version: v.union(v.number(), v.null()),
    checkRunId: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, version, checkRunId }) => {
    const build = await ctx.db.get("builds", buildId);
    if (build === null) {
      return null;
    }
    const synced = version === build.checkVersion;
    const resync = !synced && version !== null;
    await ctx.db.patch("builds", buildId, {
      githubCheckRunId: checkRunId ?? build.githubCheckRunId,
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

export async function rerequestCheck(
  ctx: MutationCtx,
  installationId: number,
  externalId: string,
) {
  const buildId = ctx.db.normalizeId("builds", externalId);
  const build = buildId === null ? null : await ctx.db.get("builds", buildId);
  const project =
    build === null ? null : await ctx.db.get("projects", build.projectId);
  const account =
    project === null ? null : await ctx.db.get("accounts", project.accountId);
  if (build !== null && account?.installationId === installationId) {
    await touchCheck(ctx, build._id);
  }
}
