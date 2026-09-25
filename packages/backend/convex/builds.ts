import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { confirmUpload, findImage, getUrl } from "./blobs";
import { touchCheck } from "./checks";
import { ciError } from "./lib/ciErrors";
import { snapshotResult, upload } from "./lib/ciRequests";
import { conclude } from "./lib/conclude";
import { requirePermission } from "./lib/permissions";
import { buildUrl } from "./lib/urls";
import { buildConclusion, buildCounts, buildStatus } from "./schema";

const EXPIRY_MS = 60 * 60 * 1000;
const MAX_ANCESTORS = 100;
const BUILDS_PER_COMMIT = 10;
const FINALIZE_PAGE_SIZE = 500;
const MAX_SUPERSEDED_PER_FINALIZE = 100;
const FALLBACK_CANDIDATES = 5;
const FALLBACK_SCAN = 50;

type Counts = Infer<typeof buildCounts>;

const EMPTY_COUNTS: Counts = {
  unchanged: 0,
  changed: 0,
  added: 0,
  removed: 0,
  failed: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

export const createOrJoin = internalMutation({
  args: {
    projectId: v.id("projects"),
    buildName: v.string(),
    nonce: v.string(),
    shardIndex: v.number(),
    shardsTotal: v.union(v.number(), v.null()),
    subset: v.boolean(),
    git: v.object({
      commit: v.string(),
      commitMessage: v.string(),
      branch: v.string(),
      baselineBranch: v.string(),
      prNumber: v.optional(v.number()),
      mergeBase: v.optional(v.string()),
      ancestors: v.array(v.string()),
    }),
    ciProvider: v.optional(v.string()),
    ciRunUrl: v.optional(v.string()),
    fallbackBaselineBuildId: v.optional(v.id("builds")),
  },
  returns: v.object({
    buildId: v.id("builds"),
    number: v.number(),
    url: v.string(),
    accountId: v.id("accounts"),
    baselineBuildId: v.union(v.id("builds"), v.null()),
    baseline: v.union(
      v.null(),
      v.object({ buildNumber: v.number(), commit: v.string() }),
    ),
    diff: v.object({ threshold: v.number(), includeAA: v.boolean() }),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (project === null) {
      throw ciError(404, "project_not_found", "Project not found.");
    }
    validateShard(args.shardIndex, args.shardsTotal);

    const existing = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_buildName_and_nonce", (q) =>
        q
          .eq("projectId", project._id)
          .eq("buildName", args.buildName)
          .eq("nonce", args.nonce),
      )
      .unique();
    const build =
      existing === null
        ? await createBuild(ctx, project, args)
        : checkJoin(existing, args.shardsTotal);

    const baseline =
      build.baselineBuildId === undefined
        ? null
        : await ctx.db.get("builds", build.baselineBuildId);
    return {
      buildId: build._id,
      number: build.number,
      url: buildUrl(project, build.number),
      accountId: project.accountId,
      baselineBuildId: baseline?._id ?? null,
      baseline:
        baseline === null
          ? null
          : { buildNumber: baseline.number, commit: baseline.commitSha },
      diff: {
        threshold: project.diffThreshold,
        includeAA: project.diffIncludeAA,
      },
    };
  },
});

function validateShard(shardIndex: number, shardsTotal: number | null) {
  const validTotal =
    shardsTotal === null || (Number.isInteger(shardsTotal) && shardsTotal >= 1);
  const validIndex =
    Number.isInteger(shardIndex) &&
    shardIndex >= 1 &&
    (shardsTotal === null || shardIndex <= shardsTotal);
  if (!validTotal || !validIndex) {
    throw ciError(
      400,
      "invalid_shard",
      "shard.index must be between 1 and shard.total.",
    );
  }
}

function checkJoin(build: Doc<"builds">, shardsTotal: number | null) {
  if (build.status !== "pending") {
    throw ciError(
      409,
      "build_not_pending",
      `Build ${build.number} is already ${build.status}. Use a new nonce for a new build.`,
    );
  }
  if ((build.shardsTotal ?? null) !== shardsTotal) {
    throw ciError(
      400,
      "shard_total_mismatch",
      `Build ${build.number} has shard.total ${build.shardsTotal ?? null}.`,
    );
  }
  return build;
}

async function createBuild(
  ctx: MutationCtx,
  project: Doc<"projects">,
  args: {
    buildName: string;
    nonce: string;
    shardsTotal: number | null;
    subset: boolean;
    git: {
      commit: string;
      commitMessage: string;
      branch: string;
      baselineBranch: string;
      prNumber?: number;
      mergeBase?: string;
      ancestors: string[];
    };
    ciProvider?: string;
    ciRunUrl?: string;
    fallbackBaselineBuildId?: Id<"builds">;
  },
): Promise<Doc<"builds">> {
  const baseline =
    (await selectBaseline(
      ctx,
      project._id,
      args.buildName,
      args.git.ancestors,
    )) ??
    (await getFallbackBaseline(
      ctx,
      project._id,
      args.buildName,
      args.fallbackBaselineBuildId,
    ));
  const number = project.nextBuildNumber;
  await ctx.db.patch("projects", project._id, { nextBuildNumber: number + 1 });

  const buildId = await ctx.db.insert("builds", {
    projectId: project._id,
    number,
    buildName: args.buildName,
    commitSha: args.git.commit,
    commitMessage: args.git.commitMessage,
    branch: args.git.branch,
    baselineBranch: args.git.baselineBranch,
    mergeBaseSha: args.git.mergeBase,
    ancestors: args.git.ancestors.slice(0, MAX_ANCESTORS),
    prNumber: args.git.prNumber,
    nonce: args.nonce,
    shardsTotal: args.shardsTotal ?? undefined,
    doneShardIndexes: [],
    subset: args.subset,
    status: "pending",
    autoApproved:
      baseline === null ||
      (args.git.prNumber === undefined &&
        project.autoApproveBranches.some((pattern) =>
          matchesBranch(pattern, args.git.branch),
        )),
    fullRows: true,
    baselineBuildId: baseline?._id,
    counts: EMPTY_COUNTS,
    storageBlocked: false,
    checkVersion: 0,
    checkOutOfSync: true,
    ciProvider: args.ciProvider,
    ciRunUrl: args.ciRunUrl,
  });
  const expiryJobId = await ctx.scheduler.runAfter(
    EXPIRY_MS,
    internal.builds.expire,
    { buildId },
  );
  await ctx.db.patch("builds", buildId, { expiryJobId });
  await touchCheck(ctx, buildId);
  const build = await ctx.db.get("builds", buildId);
  if (build === null) {
    throw new Error("Build insert failed");
  }
  return build;
}

async function selectBaseline(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  buildName: string,
  ancestors: string[],
): Promise<Doc<"builds"> | null> {
  for (const commitSha of ancestors.slice(0, MAX_ANCESTORS)) {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_buildName_and_commitSha", (q) =>
        q
          .eq("projectId", projectId)
          .eq("buildName", buildName)
          .eq("commitSha", commitSha),
      )
      .order("desc")
      .take(BUILDS_PER_COMMIT);
    const baseline = builds.find(isBaselineCandidate);
    if (baseline !== undefined) {
      return baseline;
    }
  }
  return null;
}

async function getFallbackBaseline(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  buildName: string,
  buildId: Id<"builds"> | undefined,
): Promise<Doc<"builds"> | null> {
  const build =
    buildId === undefined ? null : await ctx.db.get("builds", buildId);
  return build !== null &&
    build.projectId === projectId &&
    build.buildName === buildName &&
    isBaselineCandidate(build)
    ? build
    : null;
}

export const fallbackBaselineCandidates = internalQuery({
  args: {
    projectId: v.id("projects"),
    buildName: v.string(),
    nonce: v.string(),
    baselineBranch: v.string(),
    ancestors: v.array(v.string()),
  },
  returns: v.array(
    v.object({ buildId: v.id("builds"), commitSha: v.string() }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_buildName_and_nonce", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("buildName", args.buildName)
          .eq("nonce", args.nonce),
      )
      .unique();
    if (
      existing !== null ||
      (await selectBaseline(
        ctx,
        args.projectId,
        args.buildName,
        args.ancestors,
      )) !== null
    ) {
      return [];
    }
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_branch", (q) =>
        q.eq("projectId", args.projectId).eq("branch", args.baselineBranch),
      )
      .order("desc")
      .take(FALLBACK_SCAN);
    return builds
      .filter(
        (build) =>
          build.buildName === args.buildName && isBaselineCandidate(build),
      )
      .slice(0, FALLBACK_CANDIDATES)
      .map((build) => ({ buildId: build._id, commitSha: build.commitSha }));
  },
});

export const githubRepository = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      installationId: v.number(),
      owner: v.string(),
      name: v.string(),
    }),
  ),
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get("projects", projectId);
    const account =
      project === null ? null : await ctx.db.get("accounts", project.accountId);
    if (project === null || account?.installationId === undefined) {
      return null;
    }
    return {
      installationId: account.installationId,
      owner: project.owner,
      name: project.name,
    };
  },
});

export function matchesBranch(pattern: string, branch: string): boolean {
  const source = pattern
    .trim()
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${source}$`).test(branch);
}

function isBaselineCandidate(build: Doc<"builds">): boolean {
  return (
    build.status === "finalized" &&
    (build.conclusion === "approved" || build.conclusion === "no_changes") &&
    build.fullRows
  );
}

export const lookupSnapshots = internalQuery({
  args: {
    accountId: v.id("accounts"),
    baselineBuildId: v.union(v.id("builds"), v.null()),
    snapshots: v.array(v.object({ name: v.string(), hash: v.string() })),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      hash: v.string(),
      status: v.union(
        v.literal("unchanged"),
        v.literal("changed"),
        v.literal("added"),
      ),
      baselineUrl: v.optional(v.string()),
      uploaded: v.boolean(),
    }),
  ),
  handler: async (ctx, { accountId, baselineBuildId, snapshots }) => {
    return Promise.all(
      snapshots.map(async ({ name, hash }) => {
        const uploaded = (await findImage(ctx, accountId, hash)) !== null;
        const baselineImage =
          baselineBuildId === null
            ? null
            : await findBaselineImage(ctx, baselineBuildId, name);
        if (baselineImage === null) {
          return { name, hash, status: "added" as const, uploaded };
        }
        if (baselineImage.hash === hash) {
          return { name, hash, status: "unchanged" as const, uploaded };
        }
        const baselineUrl = await getUrl(ctx, baselineImage);
        return {
          name,
          hash,
          status: "changed" as const,
          uploaded,
          ...(baselineUrl === null ? {} : { baselineUrl }),
        };
      }),
    );
  },
});

async function findBaselineSnapshot(
  ctx: QueryCtx,
  baselineBuildId: Id<"builds">,
  name: string,
): Promise<Doc<"snapshots"> | null> {
  const snapshot = await findSnapshot(ctx, baselineBuildId, name);
  return snapshot === null || snapshot.diffStatus === "removed"
    ? null
    : snapshot;
}

async function findBaselineImage(
  ctx: QueryCtx,
  baselineBuildId: Id<"builds">,
  name: string,
): Promise<Doc<"images"> | null> {
  const snapshot = await findBaselineSnapshot(ctx, baselineBuildId, name);
  return snapshot?.imageId === undefined
    ? null
    : ctx.db.get("images", snapshot.imageId);
}

async function findSnapshot(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  name: string,
): Promise<Doc<"snapshots"> | null> {
  return ctx.db
    .query("snapshots")
    .withIndex("by_buildId_and_name", (q) =>
      q.eq("buildId", buildId).eq("name", name),
    )
    .unique();
}

export const forCi = internalQuery({
  args: { projectId: v.id("projects"), buildId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      buildId: v.id("builds"),
      accountId: v.id("accounts"),
      number: v.number(),
      url: v.string(),
      status: buildStatus,
      conclusion: v.union(buildConclusion, v.null()),
      counts: buildCounts,
      shardsTotal: v.union(v.number(), v.null()),
      shardsDone: v.number(),
    }),
  ),
  handler: async (ctx, { projectId, buildId }) => {
    const id = ctx.db.normalizeId("builds", buildId);
    const build = id === null ? null : await ctx.db.get("builds", id);
    if (build === null || build.projectId !== projectId) {
      return null;
    }
    const project = await ctx.db.get("projects", projectId);
    if (project === null) {
      return null;
    }
    return {
      buildId: build._id,
      accountId: project.accountId,
      number: build.number,
      url: buildUrl(project, build.number),
      status: build.status,
      conclusion: build.conclusion ?? null,
      counts: build.counts,
      shardsTotal: build.shardsTotal ?? null,
      shardsDone: build.doneShardIndexes.length,
    };
  },
});

export const buildIdByNonce = internalQuery({
  args: {
    projectId: v.id("projects"),
    buildName: v.string(),
    nonce: v.string(),
  },
  returns: v.union(v.id("builds"), v.null()),
  handler: async (ctx, { projectId, buildName, nonce }) => {
    const build = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_buildName_and_nonce", (q) =>
        q
          .eq("projectId", projectId)
          .eq("buildName", buildName)
          .eq("nonce", nonce),
      )
      .unique();
    return build?._id ?? null;
  },
});

async function getPendingBuild(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  shardIndex?: number,
): Promise<Doc<"builds">> {
  const build = await ctx.db.get("builds", buildId);
  if (build === null) {
    throw ciError(404, "build_not_found", "Build not found.");
  }
  if (build.status !== "pending") {
    throw ciError(
      409,
      "build_not_pending",
      `Build ${build.number} is already ${build.status}.`,
    );
  }
  if (shardIndex !== undefined) {
    validateShard(shardIndex, build.shardsTotal ?? null);
  }
  return build;
}

export const confirmUploads = internalMutation({
  args: {
    buildId: v.id("builds"),
    accountId: v.id("accounts"),
    uploads: v.array(upload),
  },
  returns: v.array(v.object({ hash: v.string(), confirmed: v.boolean() })),
  handler: async (ctx, { buildId, accountId, uploads }) => {
    await getPendingBuild(ctx, buildId);
    const results = [];
    for (const item of uploads) {
      const storageId = ctx.db.system.normalizeId("_storage", item.storageId);
      const image =
        storageId === null
          ? null
          : await confirmUpload(ctx, accountId, { ...item, storageId });
      results.push({ hash: item.hash, confirmed: image !== null });
    }
    return results;
  },
});

export const insertSnapshots = internalMutation({
  args: {
    buildId: v.id("builds"),
    accountId: v.id("accounts"),
    shardIndex: v.number(),
    results: v.array(snapshotResult),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, accountId, shardIndex, results }) => {
    const build = await getPendingBuild(ctx, buildId, shardIndex);
    const counts = { ...build.counts };
    for (const result of results) {
      const existing = await findSnapshot(ctx, buildId, result.name);
      if (existing !== null) {
        if (existing.shardIndex !== shardIndex) {
          throw ciError(
            409,
            "duplicate_snapshot_name",
            `Snapshot "${result.name}" was already sent by shard ${existing.shardIndex}.`,
          );
        }
        continue;
      }
      const compared = await toSnapshot(ctx, build, accountId, result);
      const snapshot =
        build.autoApproved && compared.reviewState === "pending"
          ? { ...compared, reviewState: "approved" as const }
          : compared;
      const snapshotId = await ctx.db.insert("snapshots", {
        buildId,
        shardIndex,
        name: result.name,
        metadata: result.metadata ?? {},
        ...snapshot,
      });
      counts[snapshot.diffStatus]++;
      if (snapshot.reviewState !== "none") {
        counts[snapshot.reviewState]++;
      }
      if (snapshot.reviewState === "approved" && snapshot.imageId) {
        await recordApproval(ctx, build, snapshotId, snapshot.imageId);
      }
    }
    await ctx.db.patch("builds", buildId, { counts });
    return null;
  },
});

async function toSnapshot(
  ctx: QueryCtx,
  build: Doc<"builds">,
  accountId: Id<"accounts">,
  result: Infer<typeof snapshotResult>,
): Promise<
  Pick<
    Doc<"snapshots">,
    | "imageId"
    | "baselineSnapshotId"
    | "baselineImageId"
    | "diffImageId"
    | "diffStatus"
    | "diffRatio"
    | "diffPixels"
    | "reviewState"
  >
> {
  const image = await findImage(ctx, accountId, result.hash.toLowerCase());
  if (result.status === "failed" || image === null) {
    return { imageId: image?._id, diffStatus: "failed", reviewState: "none" };
  }
  if (build.baselineBuildId === undefined) {
    return { imageId: image._id, diffStatus: "added", reviewState: "pending" };
  }
  const baseline = await findBaselineSnapshot(
    ctx,
    build.baselineBuildId,
    result.name,
  );
  if (baseline?.imageId === undefined) {
    return { imageId: image._id, diffStatus: "added", reviewState: "pending" };
  }
  const baselineFields = {
    imageId: image._id,
    baselineSnapshotId: baseline._id,
    baselineImageId: baseline.imageId,
  };
  if (baseline.imageId === image._id || result.status === "unchanged") {
    return { ...baselineFields, diffStatus: "unchanged", reviewState: "none" };
  }
  const diffImage =
    result.diffHash === undefined
      ? null
      : await findImage(ctx, accountId, result.diffHash.toLowerCase());
  return {
    ...baselineFields,
    diffImageId: diffImage?._id,
    diffStatus: "changed",
    diffRatio: result.diffRatio,
    diffPixels: result.diffPixels,
    reviewState: "pending",
  };
}

async function recordApproval(
  ctx: MutationCtx,
  build: Doc<"builds">,
  snapshotId: Id<"snapshots">,
  imageId: Id<"images">,
) {
  const reviewId = await ctx.db.insert("reviews", {
    snapshotId,
    buildId: build._id,
    action: "approve",
    source: build.baselineBuildId === undefined ? "orphan" : "auto_branch",
  });
  if (build.prNumber !== undefined) {
    await ctx.db.insert("approvedImages", {
      projectId: build.projectId,
      buildName: build.buildName,
      prNumber: build.prNumber,
      imageId,
      reviewId,
    });
  }
}

export const completeShard = internalMutation({
  args: {
    buildId: v.id("builds"),
    shardIndex: v.number(),
    errors: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { buildId, shardIndex, errors }) => {
    const build = await getPendingBuild(ctx, buildId, shardIndex);
    if (errors.length > 0) {
      await ctx.db.patch("builds", buildId, { status: "error" });
      await cancelExpiry(ctx, build);
      await touchCheck(ctx, buildId);
      return null;
    }
    if (build.doneShardIndexes.includes(shardIndex)) {
      return null;
    }
    const doneShardIndexes = [...build.doneShardIndexes, shardIndex];
    await ctx.db.patch("builds", buildId, { doneShardIndexes });
    await touchCheck(ctx, buildId);
    if (
      build.shardsTotal !== undefined &&
      doneShardIndexes.length >= build.shardsTotal
    ) {
      await ctx.scheduler.runAfter(0, internal.builds.finalize, {
        buildId,
        cursor: null,
      });
    }
    return null;
  },
});

export const finalize = internalMutation({
  args: { buildId: v.id("builds"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { buildId, cursor }) => {
    const build = await ctx.db.get("builds", buildId);
    if (build === null || build.status !== "pending") {
      return null;
    }
    const counts = { ...build.counts };

    if (!build.subset && build.baselineBuildId !== undefined) {
      const page = await ctx.db
        .query("snapshots")
        .withIndex("by_buildId_and_name", (q) =>
          q.eq("buildId", build.baselineBuildId as Id<"builds">),
        )
        .paginate({ numItems: FINALIZE_PAGE_SIZE, cursor });
      for (const baseline of page.page) {
        if (
          baseline.diffStatus === "removed" ||
          (await findSnapshot(ctx, buildId, baseline.name)) !== null
        ) {
          continue;
        }
        await ctx.db.insert("snapshots", {
          buildId,
          shardIndex: 0,
          name: baseline.name,
          baselineSnapshotId: baseline._id,
          baselineImageId: baseline.imageId,
          diffStatus: "removed",
          reviewState: "none",
          metadata: baseline.metadata,
        });
        counts.removed++;
      }
      if (!page.isDone) {
        await ctx.db.patch("builds", buildId, { counts });
        await ctx.scheduler.runAfter(0, internal.builds.finalize, {
          buildId,
          cursor: page.continueCursor,
        });
        return null;
      }
    }

    await ctx.db.patch("builds", buildId, {
      counts,
      status: "finalized",
      conclusion: conclude(counts),
      ancestors: [],
      finalizedAt: Date.now(),
    });
    await cancelExpiry(ctx, build);
    await supersedeEarlierBuilds(ctx, build);
    await touchCheck(ctx, buildId);
    return null;
  },
});

async function cancelExpiry(ctx: MutationCtx, build: Doc<"builds">) {
  if (build.expiryJobId !== undefined) {
    await ctx.scheduler.cancel(build.expiryJobId);
  }
}

async function supersedeEarlierBuilds(ctx: MutationCtx, build: Doc<"builds">) {
  if (build.prNumber === undefined) {
    return;
  }
  const builds = await ctx.db
    .query("builds")
    .withIndex("by_projectId_and_buildName_and_prNumber", (q) =>
      q
        .eq("projectId", build.projectId)
        .eq("buildName", build.buildName)
        .eq("prNumber", build.prNumber),
    )
    .order("desc")
    .take(MAX_SUPERSEDED_PER_FINALIZE);
  for (const earlier of builds) {
    if (
      earlier.number < build.number &&
      earlier.status === "finalized" &&
      earlier.supersededById === undefined
    ) {
      await ctx.db.patch("builds", earlier._id, { supersededById: build._id });
    }
  }
}

export const expire = internalMutation({
  args: { buildId: v.id("builds") },
  returns: v.null(),
  handler: async (ctx, { buildId }) => {
    const build = await ctx.db.get("builds", buildId);
    if (build?.status === "pending") {
      await ctx.db.patch("builds", buildId, { status: "expired" });
      await touchCheck(ctx, buildId);
    }
    return null;
  },
});

export const requestFinalize = internalMutation({
  args: { buildId: v.id("builds") },
  returns: v.null(),
  handler: async (ctx, { buildId }) => {
    await getPendingBuild(ctx, buildId);
    await ctx.scheduler.runAfter(0, internal.builds.finalize, {
      buildId,
      cursor: null,
    });
    return null;
  },
});

const buildSummary = v.object({
  number: v.number(),
  buildName: v.string(),
  branch: v.string(),
  commitSha: v.string(),
  commitMessage: v.string(),
  prNumber: v.union(v.number(), v.null()),
  status: buildStatus,
  conclusion: v.union(buildConclusion, v.null()),
  counts: buildCounts,
  superseded: v.boolean(),
  shards: v.object({
    done: v.number(),
    total: v.union(v.number(), v.null()),
  }),
  createdAt: v.number(),
});

function toBuildSummary(build: Doc<"builds">): Infer<typeof buildSummary> {
  return {
    number: build.number,
    buildName: build.buildName,
    branch: build.branch,
    commitSha: build.commitSha,
    commitMessage: build.commitMessage,
    prNumber: build.prNumber ?? null,
    status: build.status,
    conclusion: build.conclusion ?? null,
    counts: build.counts,
    superseded: build.supersededById !== undefined,
    shards: {
      done: build.doneShardIndexes.length,
      total: build.shardsTotal ?? null,
    },
    createdAt: build._creationTime,
  };
}

export const list = query({
  args: {
    projectId: v.id("projects"),
    branch: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(buildSummary),
  handler: async (ctx, { projectId, branch, paginationOpts }) => {
    await requirePermission(ctx, projectId, "read");
    const builds =
      branch === undefined
        ? ctx.db
            .query("builds")
            .withIndex("by_projectId_and_number", (q) =>
              q.eq("projectId", projectId),
            )
        : ctx.db
            .query("builds")
            .withIndex("by_projectId_and_branch", (q) =>
              q.eq("projectId", projectId).eq("branch", branch),
            );
    const page = await builds.order("desc").paginate(paginationOpts);
    return { ...page, page: page.page.map(toBuildSummary) };
  },
});

export const get = query({
  args: { projectId: v.id("projects"), number: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      ...buildSummary.fields,
      buildId: v.id("builds"),
      baselineBranch: v.string(),
      autoApproved: v.boolean(),
      finalizedAt: v.union(v.number(), v.null()),
      ciRunUrl: v.union(v.string(), v.null()),
      baseline: v.union(
        v.null(),
        v.object({ number: v.number(), branch: v.string() }),
      ),
      supersededBy: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, { projectId, number }) => {
    await requirePermission(ctx, projectId, "read");
    const build = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_number", (q) =>
        q.eq("projectId", projectId).eq("number", number),
      )
      .unique();
    if (build === null) {
      return null;
    }
    const baseline =
      build.baselineBuildId === undefined
        ? null
        : await ctx.db.get("builds", build.baselineBuildId);
    const supersededBy =
      build.supersededById === undefined
        ? null
        : await ctx.db.get("builds", build.supersededById);
    return {
      ...toBuildSummary(build),
      buildId: build._id,
      baselineBranch: build.baselineBranch,
      autoApproved: build.autoApproved,
      finalizedAt: build.finalizedAt ?? null,
      ciRunUrl: build.ciRunUrl ?? null,
      baseline:
        baseline === null
          ? null
          : { number: baseline.number, branch: baseline.branch },
      supersededBy: supersededBy?.number ?? null,
    };
  },
});
