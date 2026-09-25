import {
  ApiError,
  createApiClient,
  DEFAULT_API_URL,
  isServerError,
} from "../api";
import { defaultNonce, readCiInfo, readGitInfo, resolveToken } from "../ci-env";
import { waitForFinalize } from "../upload";
import { formatCounts } from "./upload";

export type FinalizeCommandOptions = {
  buildName?: string;
  nonce?: string;
  baselineBranch?: string;
  skipIfEmpty: boolean;
  strict: boolean;
};

export async function finalizeCommand(
  options: FinalizeCommandOptions,
): Promise<void> {
  const env = process.env;
  const buildName =
    options.buildName ?? env.STATEOFPIXEL_BUILD_NAME ?? "default";
  const nonce = options.nonce ?? env.STATEOFPIXEL_NONCE ?? defaultNonce(env);
  if (nonce === null) {
    throw new Error("Set --nonce to the nonce the shards used.");
  }
  const git = options.skipIfEmpty
    ? await readGitInfo(
        env,
        process.cwd(),
        options.baselineBranch ?? env.STATEOFPIXEL_BASELINE_BRANCH,
      )
    : undefined;

  const api = createApiClient({
    baseUrl: env.STATEOFPIXEL_API_URL ?? DEFAULT_API_URL,
    token: await resolveToken(env),
  });
  let build: { buildId: string; buildNumber: number; url: string };
  let final: Awaited<ReturnType<typeof waitForFinalize>>;
  try {
    build = await api.request("POST", "/builds/finalize", {
      buildName,
      nonce,
      skipIfEmpty: options.skipIfEmpty,
      git,
      ci: readCiInfo(env),
    });
    final = await waitForFinalize(api, build.buildId, true);
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
  }

  if (final === null) {
    console.log(`stateofpixel  build #${build.buildNumber}  finalizing`);
  } else {
    const { counts, shards } = final;
    console.log(
      `stateofpixel  build #${build.buildNumber}  finalized, ${shards.done} ${shards.done === 1 ? "shard" : "shards"}`,
    );
    console.log(
      formatCounts(
        counts.unchanged + counts.changed + counts.added + counts.failed,
        counts,
      ),
    );
  }
  console.log(`  review: ${build.url}`);
}
