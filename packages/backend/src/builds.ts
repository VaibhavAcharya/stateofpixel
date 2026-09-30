import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { confirmUploadedImages, findImages, getUrl } from "./blobs.ts";
import { touchCheck } from "./checks.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import { ciError } from "./lib/ciErrors.ts";
import { snapshotResult, upload } from "./lib/ciRequests.ts";
import { conclude } from "./lib/conclude.ts";
import { isBaselineCandidate } from "./lib/history.ts";
import {
  BUILD_EXPIRY_MS,
  DAILY_BUILDS,
  DAILY_UPLOAD_BYTES,
  MAX_ANCESTORS,
  MAX_SHARDS,
} from "./lib/limits.ts";
import { isKeptBranch, matchesBranch } from "./lib/matchesBranch.ts";
import { findReadableBuild, findReadableProject } from "./lib/permissions.ts";
import {
  formatGigabytes,
  storageState,
  storageWarnings,
} from "./lib/storage.ts";
import { buildUrl } from "./lib/urls.ts";
import { rateLimiter } from "./rateLimits.ts";
import {
  accounts,
  approvedImages,
  type buildConclusion,
  type buildCounts,
  type buildStatus,
  builds,
  deletedBuilds,
  images,
  projects,
  reviews,
  snapshots,
} from "./schema.ts";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  paginate,
  paginationOptsValidator,
  type QueryCtx,
  query,
} from "./server.ts";

const BUILDS_PER_COMMIT = 10;
const FINALIZE_PAGE_SIZE = 500;
const MAX_SUPERSEDED_PER_FINALIZE = 100;
const FALLBACK_CANDIDATES = 5;
const FALLBACK_SCAN = 50;

type Counts = z.infer<typeof buildCounts>;

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

const MAX_PREVIOUS_NONCES = 10;

async function getBuild(ctx: QueryCtx, buildId: Id<"builds">) {
  return first(
    await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
  );
}

async function getProject(ctx: QueryCtx, projectId: Id<"projects">) {
  return first(
    await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
  );
}

async function getAccount(ctx: QueryCtx, accountId: Id<"accounts">) {
  return first(
    await ctx.db.select().from(accounts).where(eq(accounts._id, accountId)),
  );
}

export const createOrJoin = internalMutation({
  args: {
    projectId: z.string(),
    buildName: z.string(),
    nonce: z.string(),
    previousNonces: z.array(z.string()),
    shardIndex: z.number().nullable(),
    shardsTotal: z.number().nullable(),
    subset: z.boolean(),
    git: z.object({
      commit: z.string(),
      commitMessage: z.string(),
      branch: z.string(),
      baselineBranch: z.string(),
      prNumber: z.number().optional(),
      mergeBase: z.string().optional(),
      ancestors: z.array(z.string()),
    }),
    ciProvider: z.string().optional(),
    ciRunUrl: z.string().optional(),
    fallbackBaselineBuildId: z.string().optional(),
    mergedPrNumber: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const project = await getProject(ctx, args.projectId);
    const account =
      project === null ? null : await getAccount(ctx, project.accountId);
    if (project === null || account === null) {
      throw ciError(404, "project_not_found", "Project not found.");
    }
    validateShard(args.shardIndex, args.shardsTotal);
    const now = Date.now();

    const existing = await findBuildForNonce(
      ctx,
      project._id,
      args.buildName,
      args.nonce,
      args.previousNonces,
    );
    const build =
      existing === null
        ? await createBuild(ctx, project, args, {
            storageBlocked: storageState(account, now) === "blocked",
          })
        : checkJoin(existing, args.shardsTotal);
    const shardIndex = args.shardIndex ?? (build.shardsJoined ?? 0) + 1;
    if (shardIndex > MAX_SHARDS) {
      throw ciError(
        400,
        "too_many_shards",
        `A build can have up to ${MAX_SHARDS} shards.`,
      );
    }
    if (args.shardIndex === null) {
      await ctx.db
        .update(builds)
        .set({ shardsJoined: shardIndex })
        .where(eq(builds._id, build._id));
    }

    const baseline =
      build.baselineBuildId === null
        ? null
        : await getBuild(ctx, build.baselineBuildId);
    return {
      buildId: build._id,
      number: build.number,
      shardIndex,
      url: buildUrl(project, build.number),
      accountId: project.accountId,
      storageBlocked: build.storageBlocked,
      warnings: storageWarnings(account, now),
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

function validateShard(shardIndex: number | null, shardsTotal: number | null) {
  const validTotal =
    shardsTotal === null ||
    (Number.isInteger(shardsTotal) &&
      shardsTotal >= 1 &&
      shardsTotal <= MAX_SHARDS);
  const validIndex =
    shardIndex === null
      ? shardsTotal === null
      : Number.isInteger(shardIndex) &&
        shardIndex >= 1 &&
        (shardsTotal === null || shardIndex <= shardsTotal);
  if (!validTotal || !validIndex) {
    throw ciError(
      400,
      "invalid_shard",
      `shard.index must be between 1 and shard.total, and shard.total at most ${MAX_SHARDS}.`,
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
    mergedPrNumber?: number;
  },
  { storageBlocked }: { storageBlocked: boolean },
): Promise<Doc<"builds">> {
  await checkDailyLimits(ctx, project.accountId);
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
  await ctx.db
    .update(projects)
    .set({
      nextBuildNumber: number + 1,
      lastBuildAt: Date.now(),
    })
    .where(eq(projects._id, project._id));

  const { _id: buildId } = one(
    await ctx.db
      .insert(builds)
      .values({
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
        mergedPrNumber: args.mergedPrNumber,
        nonce: args.nonce,
        shardsTotal: args.shardsTotal,
        doneShardIndexes: [],
        subset: args.subset,
        status: "pending",
        autoApproved:
          baseline === null ||
          (args.git.prNumber === undefined &&
            project.autoApproveBranches.some((pattern) =>
              matchesBranch(pattern, args.git.branch),
            )),
        fullRows: !args.subset,
        baselineBuildId: baseline?._id,
        counts: EMPTY_COUNTS,
        storageBlocked,
        checkVersion: 0,
        checkOutOfSync: true,
        ciProvider: args.ciProvider,
        ciRunUrl: args.ciRunUrl,
      })
      .returning({ _id: builds._id }),
  );
  const expiryJobId = await ctx.scheduler.runAfter(
    BUILD_EXPIRY_MS,
    internal.builds.expire,
    { buildId },
  );
  await ctx.db
    .update(builds)
    .set({ expiryJobId })
    .where(eq(builds._id, buildId));
  await touchCheck(ctx, buildId);
  const build = await getBuild(ctx, buildId);
  if (build === null) {
    throw new Error("Build insert failed");
  }
  return build;
}

async function checkDailyLimits(ctx: MutationCtx, accountId: Id<"accounts">) {
  const uploads = await rateLimiter.check(ctx, "uploadedBytes", {
    key: accountId,
  });
  if (!uploads.ok) {
    throw ciError(
      429,
      "upload_limit_reached",
      `This account uploaded its daily limit of ${formatGigabytes(DAILY_UPLOAD_BYTES)}. Try again in ${formatWait(uploads.retryAfter)}.`,
    );
  }
  const builds = await rateLimiter.limit(ctx, "builds", { key: accountId });
  if (!builds.ok) {
    throw ciError(
      429,
      "build_limit_reached",
      `This account created its daily limit of ${DAILY_BUILDS.toLocaleString("en-US")} builds. Try again in ${formatWait(builds.retryAfter)}.`,
    );
  }
}

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;
}

async function selectBaseline(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  buildName: string,
  ancestors: string[],
): Promise<Doc<"builds"> | null> {
  for (const commitSha of ancestors.slice(0, MAX_ANCESTORS)) {
    const candidates = await ctx.db
      .select()
      .from(builds)
      .where(
        and(
          eq(builds.projectId, projectId),
          eq(builds.buildName, buildName),
          eq(builds.commitSha, commitSha),
        ),
      )
      .orderBy(desc(builds.number))
      .limit(BUILDS_PER_COMMIT);
    const baseline = candidates.find(isBaselineCandidate);
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
  const build = buildId === undefined ? null : await getBuild(ctx, buildId);
  return build !== null &&
    build.projectId === projectId &&
    build.buildName === buildName &&
    isBaselineCandidate(build)
    ? build
    : null;
}

export const fallbackBaselineCandidates = internalQuery({
  args: {
    projectId: z.string(),
    buildName: z.string(),
    nonce: z.string(),
    baselineBranch: z.string(),
    ancestors: z.array(z.string()),
  },
  handler: async (ctx, args) => {
    const existing = await findByNonce(
      ctx,
      args.projectId,
      args.buildName,
      args.nonce,
    );
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
    const recent = await ctx.db
      .select()
      .from(builds)
      .where(
        and(
          eq(builds.projectId, args.projectId),
          eq(builds.branch, args.baselineBranch),
        ),
      )
      .orderBy(desc(builds.number))
      .limit(FALLBACK_SCAN);
    return recent
      .filter(
        (build) =>
          build.buildName === args.buildName && isBaselineCandidate(build),
      )
      .slice(0, FALLBACK_CANDIDATES)
      .map((build) => ({ buildId: build._id, commitSha: build.commitSha }));
  },
});

export const githubRepository = internalQuery({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    const project = await getProject(ctx, projectId);
    const account =
      project === null ? null : await getAccount(ctx, project.accountId);
    if (
      project === null ||
      account === null ||
      account.installationId === null
    ) {
      return null;
    }
    return {
      installationId: account.installationId,
      owner: project.owner,
      name: project.name,
    };
  },
});

export const lookupSnapshots = internalQuery({
  args: {
    baselineBuildId: z.string().nullable(),
    storageBlocked: z.boolean(),
    snapshots: z.array(z.object({ name: z.string(), hash: z.string() })),
  },
  handler: async (ctx, { baselineBuildId, storageBlocked, snapshots }) => {
    const baselineBuild =
      baselineBuildId === null ? null : await getBuild(ctx, baselineBuildId);
    const project =
      baselineBuild === null
        ? null
        : await getProject(ctx, baselineBuild.projectId);
    const baselineImages =
      baselineBuildId === null
        ? new Map<string, Doc<"images">>()
        : await findBaselineImages(
            ctx,
            baselineBuildId,
            snapshots.map((snapshot) => snapshot.name),
          );
    return Promise.all(
      snapshots.map(async ({ name, hash }) => {
        const baselineImage = baselineImages.get(name);
        if (baselineImage === undefined) {
          return { name, hash, status: "added" as const };
        }
        if (baselineImage.hash === hash) {
          return { name, hash, status: "unchanged" as const };
        }
        const baselineUrl =
          storageBlocked || project === null
            ? null
            : await getUrl(ctx, baselineImage, project);
        return {
          name,
          hash,
          status: "changed" as const,
          ...(baselineUrl === null ? {} : { baselineUrl }),
        };
      }),
    );
  },
});

async function findBaselineSnapshots(
  ctx: QueryCtx,
  baselineBuildId: Id<"builds">,
  names: string[],
): Promise<Map<string, Doc<"snapshots">>> {
  const found = await findSnapshots(ctx, baselineBuildId, names);
  for (const [name, snapshot] of found) {
    if (snapshot.diffStatus === "removed") {
      found.delete(name);
    }
  }
  return found;
}

async function findBaselineImages(
  ctx: QueryCtx,
  baselineBuildId: Id<"builds">,
  names: string[],
): Promise<Map<string, Doc<"images">>> {
  const baselines = await findBaselineSnapshots(ctx, baselineBuildId, names);
  const imageIds = [...baselines.values()].flatMap((snapshot) =>
    snapshot.imageId === null ? [] : [snapshot.imageId],
  );
  const found = new Map<string, Doc<"images">>();
  if (imageIds.length === 0) {
    return found;
  }
  const byId = new Map(
    (
      await ctx.db.select().from(images).where(inArray(images._id, imageIds))
    ).map((image) => [image._id, image]),
  );
  for (const [name, snapshot] of baselines) {
    const image =
      snapshot.imageId === null ? undefined : byId.get(snapshot.imageId);
    if (image !== undefined) {
      found.set(name, image);
    }
  }
  return found;
}

async function findSnapshots(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  names: string[],
): Promise<Map<string, Doc<"snapshots">>> {
  const found = new Map<string, Doc<"snapshots">>();
  if (names.length === 0) {
    return found;
  }
  const rows = await ctx.db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.buildId, buildId), inArray(snapshots.name, names)))
    .orderBy(asc(snapshots._creationTime), asc(snapshots._id));
  for (const row of rows) {
    if (!found.has(row.name)) {
      found.set(row.name, row);
    }
  }
  return found;
}

export const forCi = internalQuery({
  args: { projectId: z.string(), buildId: z.string() },
  handler: async (ctx, { projectId, buildId }) => {
    const build = await getBuild(ctx, buildId);
    if (build === null || build.projectId !== projectId) {
      return null;
    }
    const project = await getProject(ctx, projectId);
    if (project === null) {
      return null;
    }
    return {
      buildId: build._id,
      accountId: project.accountId,
      storageBlocked: build.storageBlocked,
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
    projectId: z.string(),
    buildName: z.string(),
    nonce: z.string(),
    previousNonces: z.array(z.string()),
  },
  handler: async (ctx, { projectId, buildName, nonce, previousNonces }) => {
    const build = await findBuildForNonce(
      ctx,
      projectId,
      buildName,
      nonce,
      previousNonces,
    );
    return build?._id ?? null;
  },
});

async function findBuildForNonce(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  buildName: string,
  nonce: string,
  previousNonces: string[],
): Promise<Doc<"builds"> | null> {
  const byNonce = (value: string) =>
    findByNonce(ctx, projectId, buildName, value);
  const build = await byNonce(nonce);
  if (build !== null) {
    return build;
  }
  for (const previous of previousNonces.slice(0, MAX_PREVIOUS_NONCES)) {
    const earlier = await byNonce(previous);
    if (earlier?.status === "pending") {
      return earlier;
    }
  }
  return null;
}

async function findByNonce(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  buildName: string,
  nonce: string,
): Promise<Doc<"builds"> | null> {
  return first(
    await ctx.db
      .select()
      .from(builds)
      .where(
        and(
          eq(builds.projectId, projectId),
          eq(builds.buildName, buildName),
          eq(builds.nonce, nonce),
        ),
      )
      .limit(1),
  );
}

async function getPendingBuild(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  shardIndex?: number,
): Promise<Doc<"builds">> {
  const build = await getBuild(ctx, buildId);
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
    buildId: z.string(),
    accountId: z.string(),
    uploads: z.array(upload),
  },
  handler: async (ctx, { buildId, accountId, uploads }) => {
    await getPendingBuild(ctx, buildId);
    return confirmUploadedImages(ctx, accountId, uploads);
  },
});

export const insertSnapshots = internalMutation({
  args: {
    buildId: z.string(),
    accountId: z.string(),
    shardIndex: z.number(),
    results: z.array(snapshotResult),
  },
  handler: async (ctx, { buildId, accountId, shardIndex, results }) => {
    const build = await getPendingBuild(ctx, buildId, shardIndex);
    const project = await getProject(ctx, build.projectId);
    const baseline = project !== null && isKeptBranch(project, build.branch);
    const counts = { ...build.counts };
    const existing = await findSnapshots(
      ctx,
      buildId,
      results.map((result) => result.name),
    );
    const fresh = results.filter((result) => {
      const snapshot = existing.get(result.name);
      if (snapshot !== undefined && snapshot.shardIndex !== shardIndex) {
        throw ciError(
          409,
          "duplicate_snapshot_name",
          `Snapshot "${result.name}" was already sent by shard ${snapshot.shardIndex}.`,
        );
      }
      return snapshot === undefined;
    });
    if (fresh.length === 0) {
      return null;
    }
    const found = await findComparisonRows(ctx, build, accountId, fresh);
    const compared = fresh.map((result) => ({
      result,
      compared: toSnapshot(build, result, found),
    }));
    const carriedApprovals = build.autoApproved
      ? new Map<Id<"images">, Doc<"approvedImages">>()
      : await findCarriedApprovals(
          ctx,
          build,
          compared.flatMap(({ compared }) =>
            compared.reviewState === "pending" && compared.imageId != null
              ? [compared.imageId]
              : [],
          ),
        );
    const rows = compared.map(({ result, compared }) => {
      const carriedApproval =
        compared.reviewState === "pending" && compared.imageId != null
          ? (carriedApprovals.get(compared.imageId) ?? null)
          : null;
      const snapshot =
        compared.reviewState === "pending" &&
        (build.autoApproved || carriedApproval !== null)
          ? { ...compared, reviewState: "approved" as const }
          : compared;
      counts[snapshot.diffStatus]++;
      if (snapshot.reviewState !== "none") {
        counts[snapshot.reviewState]++;
      }
      return { result, snapshot, carriedApproval };
    });
    const inserted = new Map(
      (
        await ctx.db
          .insert(snapshots)
          .values(
            rows.map(({ result, snapshot }) => ({
              buildId,
              shardIndex,
              name: result.name,
              metadata: result.metadata ?? {},
              ...snapshot,
            })),
          )
          .returning({ _id: snapshots._id, name: snapshots.name })
      ).map((row) => [row.name, row._id]),
    );
    await tagImages(
      ctx,
      rows.flatMap(({ snapshot }) => [snapshot.imageId, snapshot.diffImageId]),
      found.images,
      build,
      baseline,
    );
    await recordReviews(
      ctx,
      build,
      rows.map(({ result, snapshot, carriedApproval }) => ({
        snapshotId: inserted.get(result.name) as Id<"snapshots">,
        snapshot,
        carriedApproval,
      })),
    );
    await ctx.db.update(builds).set({ counts }).where(eq(builds._id, buildId));
    return null;
  },
});

type ComparisonRows = {
  images: Map<string, Doc<"images">>;
  baselines: Map<string, Doc<"snapshots">>;
};

async function findComparisonRows(
  ctx: QueryCtx,
  build: Doc<"builds">,
  accountId: Id<"accounts">,
  results: z.infer<typeof snapshotResult>[],
): Promise<ComparisonRows> {
  return {
    images: await findImages(
      ctx,
      accountId,
      results.flatMap((result) => [
        result.hash.toLowerCase(),
        ...(result.diffHash === undefined
          ? []
          : [result.diffHash.toLowerCase()]),
      ]),
    ),
    baselines:
      build.baselineBuildId === null
        ? new Map()
        : await findBaselineSnapshots(
            ctx,
            build.baselineBuildId,
            results.map((result) => result.name),
          ),
  };
}

function toSnapshot(
  build: Doc<"builds">,
  result: z.infer<typeof snapshotResult>,
  found: ComparisonRows,
): Pick<
  typeof snapshots.$inferInsert,
  | "imageId"
  | "baselineSnapshotId"
  | "baselineImageId"
  | "diffImageId"
  | "diffStatus"
  | "diffRatio"
  | "diffPixels"
  | "reviewState"
> {
  const image = found.images.get(result.hash.toLowerCase()) ?? null;
  if (result.status === "failed" || (image === null && !build.storageBlocked)) {
    return { imageId: image?._id, diffStatus: "failed", reviewState: "none" };
  }
  const reviewState = image === null ? "none" : "pending";
  if (build.baselineBuildId === null) {
    return { imageId: image?._id, diffStatus: "added", reviewState };
  }
  const baseline = found.baselines.get(result.name) ?? null;
  if (baseline === null || baseline.imageId === null) {
    return { imageId: image?._id, diffStatus: "added", reviewState };
  }
  const baselineFields = {
    imageId: image?._id,
    baselineSnapshotId: baseline._id,
    baselineImageId: baseline.imageId,
  };
  if (baseline.imageId === image?._id || result.status === "unchanged") {
    return { ...baselineFields, diffStatus: "unchanged", reviewState: "none" };
  }
  const diffImage =
    result.diffHash === undefined
      ? null
      : (found.images.get(result.diffHash.toLowerCase()) ?? null);
  return {
    ...baselineFields,
    diffImageId: diffImage?._id,
    diffStatus: "changed",
    diffRatio: result.diffRatio,
    diffPixels: result.diffPixels,
    reviewState,
  };
}

async function tagImages(
  ctx: MutationCtx,
  imageIds: (Id<"images"> | null | undefined)[],
  found: Map<string, Doc<"images">>,
  build: Doc<"builds">,
  baseline: boolean,
) {
  const ids = new Set(imageIds);
  const untagged = [...found.values()]
    .filter(
      (image) =>
        ids.has(image._id) &&
        !(
          image.projectId === null && image._creationTime < build._creationTime
        ) &&
        (image.projectId === null || (baseline && image.baseline !== true)),
    )
    .map((image) => image._id);
  if (untagged.length === 0) {
    return;
  }
  await ctx.db
    .update(images)
    .set({
      projectId: sql`coalesce(${images.projectId}, ${build.projectId})`,
      baseline: sql`coalesce(${images.baseline}, false) or ${baseline}`,
    })
    .where(inArray(images._id, untagged));
}

async function findCarriedApprovals(
  ctx: QueryCtx,
  build: Doc<"builds">,
  imageIds: Id<"images">[],
): Promise<Map<Id<"images">, Doc<"approvedImages">>> {
  const found = new Map<Id<"images">, Doc<"approvedImages">>();
  const { prNumber } = build;
  if (prNumber === null || imageIds.length === 0) {
    return found;
  }
  const rows = await ctx.db
    .select()
    .from(approvedImages)
    .where(
      and(
        eq(approvedImages.projectId, build.projectId),
        eq(approvedImages.buildName, build.buildName),
        eq(approvedImages.prNumber, prNumber),
        inArray(approvedImages.imageId, [...new Set(imageIds)]),
      ),
    )
    .orderBy(asc(approvedImages._creationTime), asc(approvedImages._id));
  for (const row of rows) {
    if (!found.has(row.imageId)) {
      found.set(row.imageId, row);
    }
  }
  return found;
}

async function recordReviews(
  ctx: MutationCtx,
  build: Doc<"builds">,
  rows: {
    snapshotId: Id<"snapshots">;
    snapshot: { reviewState: string; imageId?: Id<"images"> | null };
    carriedApproval: Doc<"approvedImages"> | null;
  }[],
) {
  const carried = rows.flatMap(({ snapshotId, carriedApproval }) =>
    carriedApproval === null
      ? []
      : [
          {
            snapshotId,
            buildId: build._id,
            action: "approve" as const,
            source: "carry_over" as const,
            sourceReviewId: carriedApproval.reviewId,
          },
        ],
  );
  if (carried.length > 0) {
    await ctx.db.insert(reviews).values(carried);
  }
  const approved = rows.flatMap(({ snapshotId, snapshot, carriedApproval }) =>
    carriedApproval === null &&
    snapshot.reviewState === "approved" &&
    snapshot.imageId
      ? [{ snapshotId, imageId: snapshot.imageId }]
      : [],
  );
  if (approved.length === 0) {
    return;
  }
  const reviewIds = await ctx.db
    .insert(reviews)
    .values(
      approved.map(({ snapshotId }) => ({
        snapshotId,
        buildId: build._id,
        action: "approve" as const,
        source:
          build.baselineBuildId === null
            ? ("orphan" as const)
            : ("auto_branch" as const),
      })),
    )
    .returning({ _id: reviews._id, snapshotId: reviews.snapshotId });
  if (build.prNumber === null) {
    return;
  }
  const imageIds = new Map(
    approved.map(({ snapshotId, imageId }) => [snapshotId, imageId]),
  );
  await ctx.db.insert(approvedImages).values(
    reviewIds.map(({ _id, snapshotId }) => ({
      projectId: build.projectId,
      buildName: build.buildName,
      prNumber: build.prNumber as number,
      imageId: imageIds.get(snapshotId) as Id<"images">,
      reviewId: _id,
    })),
  );
}

export const completeShard = internalMutation({
  args: {
    buildId: z.string(),
    shardIndex: z.number(),
    errors: z.array(z.string()),
  },
  handler: async (ctx, { buildId, shardIndex, errors }) => {
    const build = await getPendingBuild(ctx, buildId, shardIndex);
    if (errors.length > 0) {
      await ctx.db
        .update(builds)
        .set({ status: "error" })
        .where(eq(builds._id, buildId));
      await cancelExpiry(ctx, build);
      await touchCheck(ctx, buildId);
      return null;
    }
    if (build.doneShardIndexes.includes(shardIndex)) {
      return null;
    }
    const doneShardIndexes = [...build.doneShardIndexes, shardIndex];
    await ctx.db
      .update(builds)
      .set({ doneShardIndexes })
      .where(eq(builds._id, buildId));
    await touchCheck(ctx, buildId);
    if (
      build.shardsTotal !== null &&
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
  args: { buildId: z.string(), cursor: z.string().nullable() },
  handler: async (ctx, { buildId, cursor }) => {
    const build = await getBuild(ctx, buildId);
    if (build === null || build.status !== "pending") {
      return null;
    }
    const counts = { ...build.counts };

    const { baselineBuildId } = build;
    if (!build.subset && baselineBuildId !== null) {
      const page = await paginate(
        { numItems: FINALIZE_PAGE_SIZE, cursor },
        (limit, offset) =>
          ctx.db
            .select()
            .from(snapshots)
            .where(eq(snapshots.buildId, baselineBuildId))
            .orderBy(
              asc(snapshots.name),
              asc(snapshots._creationTime),
              asc(snapshots._id),
            )
            .limit(limit)
            .offset(offset),
      );
      const current = await findSnapshots(
        ctx,
        buildId,
        page.page.map((baseline) => baseline.name),
      );
      const removed = page.page.filter(
        (baseline) =>
          baseline.diffStatus !== "removed" && !current.has(baseline.name),
      );
      if (removed.length > 0) {
        await ctx.db.insert(snapshots).values(
          removed.map((baseline) => ({
            buildId,
            shardIndex: 0,
            name: baseline.name,
            baselineSnapshotId: baseline._id,
            baselineImageId: baseline.imageId,
            diffStatus: "removed" as const,
            reviewState: "none" as const,
            metadata: baseline.metadata,
          })),
        );
        counts.removed += removed.length;
      }
      if (!page.isDone) {
        await ctx.db
          .update(builds)
          .set({ counts })
          .where(eq(builds._id, buildId));
        await ctx.scheduler.runAfter(0, internal.builds.finalize, {
          buildId,
          cursor: page.continueCursor,
        });
        return null;
      }
    }

    const notCompared =
      build.storageBlocked && counts.changed + counts.added > 0;
    await ctx.db
      .update(builds)
      .set({
        counts,
        status: "finalized",
        conclusion: notCompared ? "changes" : conclude(counts),
        fullRows: build.fullRows && !notCompared,
        ancestors: [],
        finalizedAt: Date.now(),
      })
      .where(eq(builds._id, buildId));
    await cancelExpiry(ctx, build);
    await supersedeEarlierBuilds(ctx, build);
    await touchCheck(ctx, buildId);
    return null;
  },
});

async function cancelExpiry(ctx: MutationCtx, build: Doc<"builds">) {
  if (build.expiryJobId !== null) {
    await ctx.scheduler.cancel(build.expiryJobId);
  }
}

async function supersedeEarlierBuilds(ctx: MutationCtx, build: Doc<"builds">) {
  if (build.prNumber === null) {
    return;
  }
  const prBuilds = await ctx.db
    .select()
    .from(builds)
    .where(
      and(
        eq(builds.projectId, build.projectId),
        eq(builds.buildName, build.buildName),
        eq(builds.prNumber, build.prNumber),
      ),
    )
    .orderBy(desc(builds.number))
    .limit(MAX_SUPERSEDED_PER_FINALIZE);
  for (const earlier of prBuilds) {
    if (
      earlier.number < build.number &&
      earlier.status === "finalized" &&
      earlier.supersededById === null
    ) {
      await ctx.db
        .update(builds)
        .set({ supersededById: build._id })
        .where(eq(builds._id, earlier._id));
    }
  }
}

export const expire = internalMutation({
  args: { buildId: z.string() },
  handler: async (ctx, { buildId }) => {
    const build = await getBuild(ctx, buildId);
    if (build?.status === "pending") {
      await ctx.db
        .update(builds)
        .set({ status: "expired" })
        .where(eq(builds._id, buildId));
      await touchCheck(ctx, buildId);
    }
    return null;
  },
});

export const requestFinalize = internalMutation({
  args: { buildId: z.string() },
  handler: async (ctx, { buildId }) => {
    await getPendingBuild(ctx, buildId);
    await ctx.scheduler.runAfter(0, internal.builds.finalize, {
      buildId,
      cursor: null,
    });
    return null;
  },
});

function toBuildSummary(build: Doc<"builds">) {
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
    storageBlocked: build.storageBlocked,
    superseded: build.supersededById !== null,
    shards: {
      done: build.doneShardIndexes.length,
      total: build.shardsTotal ?? null,
    },
    createdAt: build._creationTime,
  };
}

const buildFilter = z.enum([
  "to_review",
  "approved",
  "rejected",
  "no_changes",
  "pending",
  "expired",
  "error",
]);

const FILTER_MATCH: Record<
  z.infer<typeof buildFilter>,
  {
    status: z.infer<typeof buildStatus>;
    conclusion?: z.infer<typeof buildConclusion>;
  }
> = {
  to_review: { status: "finalized", conclusion: "changes" },
  approved: { status: "finalized", conclusion: "approved" },
  rejected: { status: "finalized", conclusion: "rejected" },
  no_changes: { status: "finalized", conclusion: "no_changes" },
  pending: { status: "pending" },
  expired: { status: "expired" },
  error: { status: "error" },
};

export const list = query({
  args: {
    owner: z.string(),
    name: z.string(),
    branch: z.string().optional(),
    prNumber: z.number().optional(),
    states: z.array(buildFilter).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const project = await findReadableProject(ctx, args.owner, args.name);
    if (project === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const projectId = project._id;
    const { branch, prNumber } = args;
    const matches = (args.states ?? []).map((state) => FILTER_MATCH[state]);
    const direction = args.order === "asc" ? asc : desc;
    const page = await paginate(args.paginationOpts, (limit, offset) =>
      ctx.db
        .select()
        .from(builds)
        .where(
          and(
            eq(builds.projectId, projectId),
            prNumber === undefined ? undefined : eq(builds.prNumber, prNumber),
            branch === undefined ? undefined : eq(builds.branch, branch),
            matches.length === 0
              ? undefined
              : or(
                  ...matches.map(({ status, conclusion }) =>
                    and(
                      eq(builds.status, status),
                      conclusion === undefined
                        ? undefined
                        : eq(builds.conclusion, conclusion),
                    ),
                  ),
                ),
          ),
        )
        .orderBy(direction(builds.number))
        .limit(limit)
        .offset(offset),
    );
    return { ...page, page: page.page.map(toBuildSummary) };
  },
});

export const get = query({
  args: { owner: z.string(), name: z.string(), number: z.number() },
  handler: async (ctx, args) => {
    const build = await findReadableBuild(ctx, args);
    if (build === null) {
      return null;
    }
    const baseline =
      build.baselineBuildId === null
        ? null
        : await getBuild(ctx, build.baselineBuildId);
    const supersededBy =
      build.supersededById === null
        ? null
        : await getBuild(ctx, build.supersededById);
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
      mergedPr:
        build.mergedPrNumber === null
          ? null
          : {
              number: build.mergedPrNumber,
              lastBuildNumber:
                (await findLastPrBuild(ctx, build, build.mergedPrNumber))
                  ?.number ?? null,
            },
    };
  },
});

export const deleted = query({
  args: { owner: z.string(), name: z.string(), number: z.number() },
  handler: async (ctx, { owner, name, number }) => {
    const project = await findReadableProject(ctx, owner, name);
    if (
      project === null ||
      !Number.isInteger(number) ||
      number < 1 ||
      number >= project.nextBuildNumber
    ) {
      return null;
    }
    const build = first(
      await ctx.db
        .select({ _id: builds._id })
        .from(builds)
        .where(
          and(eq(builds.projectId, project._id), eq(builds.number, number)),
        ),
    );
    if (build !== null) {
      return null;
    }
    const deletion = first(
      await ctx.db
        .select()
        .from(deletedBuilds)
        .where(
          and(
            eq(deletedBuilds.projectId, project._id),
            eq(deletedBuilds.number, number),
          ),
        )
        .limit(1),
    );
    return {
      deletion:
        deletion === null
          ? null
          : {
              branch: deletion.branch,
              prNumber: deletion.prNumber ?? null,
              reason: deletion.reason,
              retentionDays: deletion.retentionDays,
              deletedAt: deletion._creationTime,
            },
    };
  },
});

async function findLastPrBuild(
  ctx: QueryCtx,
  build: Doc<"builds">,
  prNumber: number,
): Promise<Doc<"builds"> | null> {
  return first(
    await ctx.db
      .select()
      .from(builds)
      .where(
        and(
          eq(builds.projectId, build.projectId),
          eq(builds.buildName, build.buildName),
          eq(builds.prNumber, prNumber),
        ),
      )
      .orderBy(desc(builds.number))
      .limit(1),
  );
}
