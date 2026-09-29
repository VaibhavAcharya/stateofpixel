import { readFile, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import {
  type ApiClient,
  ApiError,
  type BuildResponse,
  type CreateBuildResponse,
  type SnapshotLookup,
} from "./api";
import type { CiInfo, GitInfo } from "./ci-env";
import type { DiffEngine } from "./diff/engine";
import { mapConcurrent } from "./map-concurrent";
import { readPngSize, sha256 } from "./png";
import { collectSnapshots } from "./snapshots";

const UPLOAD_CONCURRENCY = 8;
const FINALIZE_POLLS = 10;
const FINALIZE_POLL_MS = 1000;

export type LocalSnapshot = {
  name: string;
  file: string;
  hash: string;
  bytes: number;
  width: number;
  height: number;
  metadata?: Record<string, unknown>;
};

type Upload = {
  hash: string;
  storageId: string;
  kind: "screenshot" | "diff";
  width: number;
  height: number;
};

export type ShardResult = {
  name: string;
  hash: string;
  status: "unchanged" | "changed" | "added" | "failed";
  diffHash?: string;
  diffRatio?: number;
  diffPixels?: number;
  metadata?: Record<string, unknown>;
};

export type Shard = { index: number | null; total: number | null };

export type UploadInput = {
  dir: string;
  workDir: string;
  api: ApiClient;
  engine: DiffEngine;
  buildName: string;
  nonce: string;
  previousNonces?: string[];
  shard: Shard;
  subset: boolean;
  threshold?: number;
  git: GitInfo;
  ci: CiInfo;
};

export type UploadOutput = {
  build: CreateBuildResponse;
  results: ShardResult[];
  uploadedImages: number;
  uploadedBytes: number;
  failedUploads: string[];
  uploadErrors: string[];
  final: BuildResponse | null;
};

export async function readSnapshots(dir: string): Promise<LocalSnapshot[]> {
  const files = await collectSnapshots(dir);
  return mapConcurrent(
    [...files],
    availableParallelism(),
    async ([name, file]) => {
      const bytes = await readFile(file);
      const metadata = await readMetadata(file);
      return {
        name,
        file,
        hash: sha256(bytes),
        bytes: bytes.length,
        ...readPngSize(bytes),
        ...(metadata === undefined ? {} : { metadata }),
      };
    },
  );
}

export function metadataFile(pngFile: string): string {
  return `${pngFile.slice(0, -".png".length)}.meta.json`;
}

async function readMetadata(
  pngFile: string,
): Promise<Record<string, unknown> | undefined> {
  const text = await readFile(metadataFile(pngFile), "utf8").catch(
    () => undefined,
  );
  return text === undefined ? undefined : JSON.parse(text);
}

export async function uploadDirectory(
  input: UploadInput,
): Promise<UploadOutput> {
  const snapshots = await readSnapshots(input.dir);
  const build = await input.api.request<CreateBuildResponse>(
    "POST",
    "/builds",
    {
      buildName: input.buildName,
      nonce: input.nonce,
      ...(input.previousNonces?.length
        ? { previousNonces: input.previousNonces }
        : {}),
      shard: input.shard,
      subset: input.subset,
      git: input.git,
      ci: input.ci,
      snapshots: snapshots.map(({ name, hash, bytes, width, height }) => ({
        name,
        hash,
        bytes,
        width,
        height,
      })),
    },
  );
  const lookups = new Map(
    build.snapshots.map((lookup) => [lookup.name, lookup]),
  );

  const failedUploads: string[] = [];
  const uploadErrors: string[] = [];
  const uploads: Upload[] = [];
  let uploadedBytes = 0;
  const pendingUploads = uniqueByHash(
    snapshots.filter((snapshot) => lookups.get(snapshot.name)?.uploadUrl),
  );
  await mapConcurrent(pendingUploads, UPLOAD_CONCURRENCY, async (snapshot) => {
    const uploadUrl = lookups.get(snapshot.name)?.uploadUrl as string;
    try {
      const bytes = await readFile(snapshot.file);
      uploads.push({
        hash: snapshot.hash,
        storageId: await input.api.upload(uploadUrl, bytes),
        kind: "screenshot",
        width: snapshot.width,
        height: snapshot.height,
      });
      uploadedBytes += bytes.length;
    } catch (error) {
      failedUploads.push(snapshot.hash);
      uploadErrors.push(describeError(error));
    }
  });

  const failedScreenshots = new Set(failedUploads);
  const options = {
    threshold: input.threshold ?? build.diff.threshold,
    includeAA: build.diff.includeAA,
  };
  const diffs = new Map<
    string,
    { file: string; hash: string; width: number; height: number }
  >();
  const results = await mapConcurrent(
    snapshots,
    availableParallelism(),
    async (snapshot, index): Promise<ShardResult> => {
      const lookup = lookups.get(snapshot.name) as SnapshotLookup;
      const base = {
        name: snapshot.name,
        hash: snapshot.hash,
        ...(snapshot.metadata === undefined
          ? {}
          : { metadata: snapshot.metadata }),
      };
      if (failedScreenshots.has(snapshot.hash)) {
        return { ...base, status: "failed" };
      }
      if (lookup.status !== "changed") {
        return { ...base, status: lookup.status };
      }
      if (lookup.baselineUrl === undefined) {
        return { ...base, status: "changed" };
      }
      try {
        const baselineFile = path.join(input.workDir, `baseline-${index}.png`);
        const diffFile = path.join(input.workDir, `diff-${index}.png`);
        await writeFile(
          baselineFile,
          await input.api.download(lookup.baselineUrl),
        );
        const { diffPixels, diffRatio } = await input.engine.diff(
          baselineFile,
          snapshot.file,
          diffFile,
          options,
        );
        if (diffPixels === 0) {
          return { ...base, status: "unchanged" };
        }
        const diffBytes = await readFile(diffFile);
        const diffHash = sha256(diffBytes);
        diffs.set(diffHash, {
          file: diffFile,
          hash: diffHash,
          ...readPngSize(diffBytes),
        });
        return { ...base, status: "changed", diffHash, diffRatio, diffPixels };
      } catch {
        return { ...base, status: "failed" };
      }
    },
  );

  if (diffs.size > 0) {
    const { uploads: diffTargets } = await input.api.request<{
      uploads: { hash: string; uploadUrl: string }[];
    }>("POST", `/builds/${build.buildId}/upload-urls`, {
      hashes: [...diffs.keys()],
    });
    await mapConcurrent(
      diffTargets,
      UPLOAD_CONCURRENCY,
      async ({ hash, uploadUrl }) => {
        const diff = diffs.get(hash);
        if (diff === undefined) {
          return;
        }
        try {
          const bytes = await readFile(diff.file);
          uploads.push({
            hash,
            storageId: await input.api.upload(uploadUrl, bytes),
            kind: "diff",
            width: diff.width,
            height: diff.height,
          });
          uploadedBytes += bytes.length;
        } catch (error) {
          failedUploads.push(hash);
          uploadErrors.push(describeError(error));
        }
      },
    );
  }

  const { rejectedUploads } = await input.api.request<{
    rejectedUploads: string[];
  }>("POST", `/builds/${build.buildId}/shards/${build.shardIndex}/complete`, {
    uploads,
    results,
  });
  failedUploads.push(...rejectedUploads);
  uploadErrors.push(
    ...rejectedUploads.map(
      () => "stateofpixel rejected the image: its size, dimensions or hash",
    ),
  );

  return {
    build,
    results,
    uploadedImages: uploads.length,
    uploadedBytes,
    failedUploads,
    uploadErrors,
    final: await waitForFinalize(input.api, build.buildId, false),
  };
}

export async function waitForFinalize(
  api: ApiClient,
  buildId: string,
  finalizeRequested: boolean,
): Promise<BuildResponse | null> {
  for (let poll = 0; poll < FINALIZE_POLLS; poll++) {
    const build = await api.request<BuildResponse>("GET", `/builds/${buildId}`);
    const lastShardDone =
      build.shards.total !== null && build.shards.done >= build.shards.total;
    if (build.status !== "pending" || !(finalizeRequested || lastShardDone)) {
      return build.status === "finalized" ? build : null;
    }
    await new Promise((resolve) => setTimeout(resolve, FINALIZE_POLL_MS));
  }
  return null;
}

function uniqueByHash(snapshots: LocalSnapshot[]): LocalSnapshot[] {
  return [
    ...new Map(snapshots.map((snapshot) => [snapshot.hash, snapshot])).values(),
  ];
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return `HTTP ${error.status}, ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function summarizeUploadErrors(errors: string[]): string {
  const counts = new Map<string, number>();
  for (const error of errors) {
    counts.set(error, (counts.get(error) ?? 0) + 1);
  }
  return [...counts]
    .map(([error, count]) => `  ${count} x ${error}`)
    .join("\n");
}
