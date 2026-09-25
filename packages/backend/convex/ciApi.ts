import type { GenericValidator, Infer } from "convex/values";
import { ConvexError } from "convex/values";
import { validate } from "convex-helpers/validators";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, httpAction } from "./_generated/server";
import { authenticateCi, type CiAuth } from "./ciAuth";
import { ciError, isCiErrorData } from "./lib/ciErrors";
import {
  type CreateBuildRequest,
  completeShardRequest,
  createBuildRequest,
  type FinalizeRequest,
  finalizeRequest,
  type GitInfo,
  uploadUrlsRequest,
} from "./lib/ciRequests";
import {
  createInstallationToken,
  findMergedPullRequest,
  GithubError,
  isAncestor,
} from "./lib/github";
import { rateLimiter } from "./rateLimits";
import { DEFAULT_BUILD_NAME } from "./schema";

const CHUNK_SIZE = 1000;
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_SNAPSHOTS_PER_BUILD = 20_000;
const MAX_NAME_LENGTH = 512;
const MAX_METADATA_BYTES = 4096;
const SHA256_HEX = /^[0-9a-f]{64}$/i;
const SHARD_COMPLETE_PATH =
  /^\/api\/v1\/builds\/([^/]+)\/shards\/(\d+)\/complete$/;
const UPLOAD_URLS_PATH = /^\/api\/v1\/builds\/([^/]+)\/upload-urls$/;
const BUILD_PATH = /^\/api\/v1\/builds\/([^/]+)$/;

type CiHandler = (
  ctx: ActionCtx,
  request: Request,
  auth: CiAuth,
) => Promise<Response>;

function ciRoute(handler: CiHandler) {
  return httpAction(async (ctx, request) => {
    const auth = await authenticateCi(ctx, request);
    if (auth === null) {
      return errorResponse(
        401,
        "unauthorized",
        "Use a GitHub Actions OIDC token with audience stateofpixel, or a project token.",
      );
    }
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "ciRequests", {
      key:
        auth.method === "token"
          ? `token:${auth.tokenHash}`
          : `oidc:${auth.project.id}`,
    });
    if (!ok) {
      return errorResponse(
        429,
        "rate_limited",
        `Too many requests for this token. Try again in ${Math.ceil(retryAfter / 1000)} s.`,
      );
    }
    try {
      return await handler(ctx, request, auth);
    } catch (error) {
      if (error instanceof ConvexError && isCiErrorData(error.data)) {
        return errorResponse(
          error.data.status,
          error.data.code,
          error.data.message,
        );
      }
      throw error;
    }
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function readBody<V extends GenericValidator>(
  request: Request,
  validator: V,
): Promise<Infer<V>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw ciError(
      413,
      "body_too_large",
      `Body is over ${MAX_BODY_BYTES / 1024 / 1024} MB. Split the snapshots over several shards.`,
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw ciError(400, "invalid_request", "Body must be JSON.");
  }
  try {
    validate(validator, body, { throw: true });
  } catch (error) {
    throw ciError(
      400,
      "invalid_request",
      error instanceof Error ? error.message : "Invalid body.",
    );
  }
  return body as Infer<V>;
}

function checkHashes(hashes: string[]) {
  const invalid = hashes.find((hash) => !SHA256_HEX.test(hash));
  if (invalid !== undefined) {
    throw ciError(
      400,
      "invalid_hash",
      `"${invalid}" is not a SHA-256 hex digest.`,
    );
  }
}

function checkSnapshotCount(count: number) {
  if (count > MAX_SNAPSHOTS_PER_BUILD) {
    throw ciError(
      400,
      "too_many_snapshots",
      `A build can have up to ${MAX_SNAPSHOTS_PER_BUILD.toLocaleString("en-US")} snapshots.`,
    );
  }
}

function checkNames(names: string[]) {
  const seen = new Set<string>();
  for (const name of names) {
    if (name.length > MAX_NAME_LENGTH) {
      throw ciError(
        400,
        "snapshot_name_too_long",
        `Snapshot name "${name.slice(0, 50)}..." is over ${MAX_NAME_LENGTH} characters.`,
      );
    }
    if (name === "") {
      throw ciError(
        400,
        "invalid_snapshot_name",
        "Snapshot names cannot be empty.",
      );
    }
    if (seen.has(name)) {
      throw ciError(
        400,
        "duplicate_snapshot_name",
        `Snapshot "${name}" appears more than once.`,
      );
    }
    seen.add(name);
  }
}

function checkMetadata(items: { name: string; metadata?: unknown }[]) {
  for (const item of items) {
    if (
      item.metadata !== undefined &&
      JSON.stringify(item.metadata).length > MAX_METADATA_BYTES
    ) {
      throw ciError(
        400,
        "metadata_too_large",
        `Metadata of "${item.name}" is over ${MAX_METADATA_BYTES} bytes.`,
      );
    }
  }
}

function checkOidcCommit(auth: CiAuth, git: GitInfo) {
  if (auth.method !== "oidc" || auth.claims.sha === git.commit) {
    return;
  }
  const prRef =
    typeof git.prNumber === "number"
      ? `refs/pull/${git.prNumber}/merge`
      : undefined;
  if (auth.claims.ref !== prRef) {
    throw ciError(
      403,
      "commit_mismatch",
      "git.commit does not match the commit of this GitHub Actions run.",
    );
  }
}

function toBuildGit(git: GitInfo) {
  return {
    commit: git.commit,
    commitMessage: (git.commitMessage ?? "").split("\n")[0] ?? "",
    branch: git.branch,
    baselineBranch: git.baselineBranch,
    prNumber: git.prNumber ?? undefined,
    mergeBase: git.mergeBase ?? undefined,
    ancestors: git.ancestors,
  };
}

function chunk<T>(items: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

export const whoami = ciRoute(async (_ctx, _request, auth) =>
  Response.json({ project: auth.project.fullName, method: auth.method }),
);

export const createBuild = ciRoute(async (ctx, request, auth) => {
  const body = await readBody(request, createBuildRequest);
  checkSnapshotCount(body.snapshots.length);
  checkNames(body.snapshots.map((snapshot) => snapshot.name));
  checkHashes(body.snapshots.map((snapshot) => snapshot.hash));
  checkMetadata(body.snapshots);
  checkOidcCommit(auth, body.git);
  const buildName = body.buildName ?? DEFAULT_BUILD_NAME;
  const joining =
    (await ctx.runQuery(internal.builds.buildIdByNonce, {
      projectId: auth.project.id,
      buildName,
      nonce: body.nonce,
    })) !== null;

  const build = await ctx.runMutation(internal.builds.createOrJoin, {
    projectId: auth.project.id,
    buildName,
    nonce: body.nonce,
    shardIndex: body.shard.index,
    shardsTotal: body.shard.total,
    subset: body.subset ?? false,
    git: toBuildGit(body.git),
    ciProvider: body.ci?.provider,
    ciRunUrl: body.ci?.runUrl,
    fallbackBaselineBuildId: joining
      ? undefined
      : await findFallbackBaseline(ctx, auth, buildName, body),
    mergedPrNumber:
      joining || typeof body.git.prNumber === "number"
        ? undefined
        : await findMergedPr(ctx, auth, body.git),
  });

  const lookups = (
    await Promise.all(
      chunk(
        body.snapshots.map(({ name, hash }) => ({
          name,
          hash: hash.toLowerCase(),
        })),
      ).map((snapshots) =>
        ctx.runQuery(internal.builds.lookupSnapshots, {
          baselineBuildId: build.baselineBuildId,
          storageBlocked: build.storageBlocked,
          snapshots,
        }),
      ),
    )
  ).flat();

  const uploadUrls = await createUploadUrls(
    ctx,
    build,
    lookups.map((lookup) => lookup.hash),
  );

  return Response.json({
    buildId: build.buildId,
    buildNumber: build.number,
    shardIndex: build.shardIndex,
    url: build.url,
    diff: build.diff,
    baseline: build.baseline,
    snapshots: lookups.map((snapshot) => ({
      ...snapshot,
      ...(uploadUrls.has(snapshot.hash)
        ? { uploadUrl: uploadUrls.get(snapshot.hash) }
        : {}),
    })),
    warnings: build.warnings,
  });
});

async function findFallbackBaseline(
  ctx: ActionCtx,
  auth: CiAuth,
  buildName: string,
  body: CreateBuildRequest,
): Promise<Id<"builds"> | undefined> {
  const candidates = await ctx.runQuery(
    internal.builds.fallbackBaselineCandidates,
    {
      projectId: auth.project.id,
      buildName,
      nonce: body.nonce,
      baselineBranch: body.git.baselineBranch,
      ancestors: body.git.ancestors,
    },
  );
  if (candidates.length === 0) {
    return undefined;
  }
  const repository = await ctx.runQuery(internal.builds.githubRepository, {
    projectId: auth.project.id,
  });
  if (repository === null) {
    return undefined;
  }
  const token = await createInstallationToken(repository.installationId);
  for (const candidate of candidates) {
    if (
      await isAncestor(
        token,
        repository.owner,
        repository.name,
        candidate.commitSha,
        body.git.commit,
      )
    ) {
      return candidate.buildId;
    }
  }
  return undefined;
}

async function findMergedPr(
  ctx: ActionCtx,
  auth: CiAuth,
  git: GitInfo,
): Promise<number | undefined> {
  const repository = await ctx.runQuery(internal.builds.githubRepository, {
    projectId: auth.project.id,
  });
  if (repository === null) {
    return undefined;
  }
  try {
    const prNumber = await findMergedPullRequest(
      await createInstallationToken(repository.installationId),
      repository.owner,
      repository.name,
      git.commit,
      git.branch,
    );
    return prNumber ?? undefined;
  } catch (error) {
    if (error instanceof GithubError) {
      return undefined;
    }
    throw error;
  }
}

async function createUploadUrls(
  ctx: ActionCtx,
  build: { accountId: Id<"accounts">; storageBlocked: boolean },
  hashes: string[],
): Promise<Map<string, string>> {
  const targets = await Promise.all(
    chunk([...new Set(hashes)]).map((chunkHashes) =>
      ctx.runMutation(internal.blobs.createUploadTargets, {
        accountId: build.accountId,
        storageBlocked: build.storageBlocked,
        hashes: chunkHashes,
      }),
    ),
  );
  return new Map(
    targets.flat().map(({ hash, uploadUrl }) => [hash, uploadUrl]),
  );
}

async function getBuildForCi(ctx: ActionCtx, auth: CiAuth, buildId: string) {
  const build = await ctx.runQuery(internal.builds.forCi, {
    projectId: auth.project.id,
    buildId,
  });
  if (build === null) {
    throw ciError(404, "build_not_found", "Build not found.");
  }
  return build;
}

async function completeShard(
  ctx: ActionCtx,
  request: Request,
  auth: CiAuth,
  buildIdParam: string,
  shardIndex: number,
) {
  const build = await getBuildForCi(ctx, auth, buildIdParam);
  const body = await readBody(request, completeShardRequest);
  const { counts } = build;
  checkSnapshotCount(
    counts.unchanged +
      counts.changed +
      counts.added +
      counts.failed +
      body.results.length,
  );
  checkNames(body.results.map((result) => result.name));
  checkHashes([
    ...body.uploads.map((upload) => upload.hash),
    ...body.results.map((result) => result.hash),
    ...body.results.flatMap((result) =>
      result.diffHash === undefined ? [] : [result.diffHash],
    ),
  ]);
  checkMetadata(body.results);

  const confirmed = (
    await Promise.all(
      chunk(body.uploads).map((uploads) =>
        ctx.runMutation(internal.builds.confirmUploads, {
          buildId: build.buildId,
          accountId: build.accountId,
          uploads,
        }),
      ),
    )
  ).flat();

  for (const results of chunk(body.results)) {
    await ctx.runMutation(internal.builds.insertSnapshots, {
      buildId: build.buildId,
      accountId: build.accountId,
      shardIndex,
      results,
    });
  }
  await ctx.runMutation(internal.builds.completeShard, {
    buildId: build.buildId,
    shardIndex,
    errors: body.errors ?? [],
  });

  return Response.json({
    rejectedUploads: confirmed
      .filter((upload) => !upload.confirmed)
      .map((upload) => upload.hash),
  });
}

async function createUploadUrlsForBuild(
  ctx: ActionCtx,
  request: Request,
  auth: CiAuth,
  buildIdParam: string,
) {
  const build = await getBuildForCi(ctx, auth, buildIdParam);
  const body = await readBody(request, uploadUrlsRequest);
  checkHashes(body.hashes);
  const uploadUrls = await createUploadUrls(
    ctx,
    build,
    body.hashes.map((hash) => hash.toLowerCase()),
  );
  return Response.json({
    uploads: [...uploadUrls].map(([hash, uploadUrl]) => ({ hash, uploadUrl })),
  });
}

export const buildAction = ciRoute(async (ctx, request, auth) => {
  const { pathname } = new URL(request.url);
  const shardMatch = SHARD_COMPLETE_PATH.exec(pathname);
  if (shardMatch?.[1] !== undefined && shardMatch[2] !== undefined) {
    return completeShard(
      ctx,
      request,
      auth,
      shardMatch[1],
      Number(shardMatch[2]),
    );
  }
  const uploadUrlsMatch = UPLOAD_URLS_PATH.exec(pathname);
  if (uploadUrlsMatch?.[1] !== undefined) {
    return createUploadUrlsForBuild(ctx, request, auth, uploadUrlsMatch[1]);
  }
  throw ciError(404, "not_found", `No route for POST ${pathname}.`);
});

export const finalizeBuild = ciRoute(async (ctx, request, auth) => {
  const body = await readBody(request, finalizeRequest);
  const buildName = body.buildName ?? DEFAULT_BUILD_NAME;
  const buildId =
    (await ctx.runQuery(internal.builds.buildIdByNonce, {
      projectId: auth.project.id,
      buildName,
      nonce: body.nonce,
    })) ?? (await createEmptyBuild(ctx, auth, buildName, body));
  await ctx.runMutation(internal.builds.requestFinalize, { buildId });
  const build = await getBuildForCi(ctx, auth, buildId);
  return Response.json({ buildId, buildNumber: build.number, url: build.url });
});

async function createEmptyBuild(
  ctx: ActionCtx,
  auth: CiAuth,
  buildName: string,
  body: FinalizeRequest,
): Promise<Id<"builds">> {
  if (!body.skipIfEmpty) {
    throw ciError(404, "build_not_found", "No build with this nonce.");
  }
  if (body.git === undefined) {
    throw ciError(400, "invalid_request", "skipIfEmpty needs git.");
  }
  checkOidcCommit(auth, body.git);
  const build = await ctx.runMutation(internal.builds.createOrJoin, {
    projectId: auth.project.id,
    buildName,
    nonce: body.nonce,
    shardIndex: null,
    shardsTotal: null,
    subset: true,
    git: toBuildGit(body.git),
    ciProvider: body.ci?.provider,
    ciRunUrl: body.ci?.runUrl,
  });
  return build.buildId;
}

export const getBuild = ciRoute(async (ctx, request, auth) => {
  const { pathname } = new URL(request.url);
  const buildId = BUILD_PATH.exec(pathname)?.[1];
  if (buildId === undefined) {
    throw ciError(404, "not_found", `No route for GET ${pathname}.`);
  }
  const build = await getBuildForCi(ctx, auth, buildId);
  return Response.json({
    buildId: build.buildId,
    buildNumber: build.number,
    url: build.url,
    status: build.status,
    conclusion: build.conclusion,
    counts: build.counts,
    shards: { done: build.shardsDone, total: build.shardsTotal },
  });
});
