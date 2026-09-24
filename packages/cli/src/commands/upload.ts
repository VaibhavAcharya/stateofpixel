import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { InvalidArgumentError } from "commander";
import {
  ApiError,
  createApiClient,
  DEFAULT_API_URL,
  isServerError,
} from "../api";
import { defaultNonce, readCiInfo, readGitInfo, resolveToken } from "../ci-env";
import { createDiffEngine } from "../diff/engine";
import { readSnapshots, type UploadOutput, uploadDirectory } from "../upload";

export type UploadCommandOptions = {
  buildName?: string;
  shard?: { index: number; total: number };
  nonce?: string;
  baselineBranch?: string;
  subset: boolean;
  threshold?: number;
  strict: boolean;
  dryRun: boolean;
};

export async function uploadCommand(
  dir: string,
  options: UploadCommandOptions,
): Promise<void> {
  const env = process.env;
  const stats = await stat(dir).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
  const shard = options.shard ?? parseShard(env.STATEOFPIXEL_SHARD ?? "1/1");
  const buildName =
    options.buildName ?? env.STATEOFPIXEL_BUILD_NAME ?? "default";
  const nonce = options.nonce ?? env.STATEOFPIXEL_NONCE ?? defaultNonce(env);
  if (nonce === null && shard.total > 1) {
    throw new Error("Set --nonce so every shard joins the same build.");
  }
  const git = await readGitInfo(
    env,
    process.cwd(),
    options.baselineBranch ?? env.STATEOFPIXEL_BASELINE_BRANCH,
  );

  if (options.dryRun) {
    const snapshots = await readSnapshots(dir);
    console.log(
      `stateofpixel  dry run  ${git.branch} vs ${git.baselineBranch}`,
    );
    console.log(`  ${formatCount(snapshots.length)} snapshots in ${dir}`);
    console.log(
      `  build ${buildName}, shard ${shard.index}/${shard.total}, commit ${git.commit.slice(0, 7)}, ${git.ancestors.length} ancestors`,
    );
    return;
  }

  const startedAt = performance.now();
  const workDir = await mkdtemp(path.join(tmpdir(), "stateofpixel-upload-"));
  let output: UploadOutput;
  try {
    output = await uploadDirectory({
      dir,
      workDir,
      api: createApiClient({
        baseUrl: env.STATEOFPIXEL_API_URL ?? DEFAULT_API_URL,
        token: await resolveToken(env),
      }),
      engine: await createDiffEngine(),
      buildName,
      nonce: nonce ?? `local-${Date.now()}`,
      shard,
      subset: options.subset,
      threshold: options.threshold,
      git,
      ci: readCiInfo(env),
    });
  } catch (error) {
    if (isServerError(error) && !options.strict) {
      console.warn(
        `stateofpixel: skipped, the service is not reachable (${error instanceof Error ? error.message : error}). Use --strict to fail instead.`,
      );
      return;
    }
    if (error instanceof ApiError) {
      throw new Error(`${error.message} (${error.code})`);
    }
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  printSummary(output, git.branch, git.baselineBranch, startedAt);
  if (output.failedUploads.length > 0) {
    throw new Error(`${output.failedUploads.length} uploads failed.`);
  }
}

function printSummary(
  output: UploadOutput,
  branch: string,
  baselineBranch: string,
  startedAt: number,
) {
  const { build, results, final } = output;
  const counts = final?.counts ?? countResults(results);
  const baseline =
    build.baseline === null ? "no baseline" : `#${build.baseline.buildNumber}`;
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  const megabytes = (output.uploadedBytes / 1024 / 1024).toFixed(1);
  console.log(
    `stateofpixel  build #${build.buildNumber}  ${branch} vs ${baselineBranch} (${baseline})`,
  );
  console.log(
    `  ${formatCount(results.length)} snapshots  ${formatCount(counts.unchanged)} unchanged  ${formatCount(counts.changed)} changed  ${formatCount(counts.added)} added  ${formatCount(counts.removed)} removed${counts.failed > 0 ? `  ${formatCount(counts.failed)} failed` : ""}`,
  );
  console.log(
    `  uploaded ${formatCount(output.uploadedImages)} images (${megabytes} MB) in ${seconds} s`,
  );
  for (const warning of build.warnings) {
    console.log(`  warning: ${warning}`);
  }
  console.log(`  review: ${build.url}`);
}

function countResults(results: UploadOutput["results"]) {
  const counts = { unchanged: 0, changed: 0, added: 0, removed: 0, failed: 0 };
  for (const result of results) {
    counts[result.status]++;
  }
  return counts;
}

export function parseShard(value: string): { index: number; total: number } {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  const index = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (!match || index < 1 || total < 1 || index > total) {
    throw new InvalidArgumentError("Must look like 1/4.");
  }
  return { index, total };
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}
