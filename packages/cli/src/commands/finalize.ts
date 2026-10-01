import {
  ApiError,
  createApiClient,
  isRateLimited,
  isServerError,
} from "../api";
import {
  defaultNonce,
  ForkPullRequestError,
  previousNonces,
  readCiInfo,
  readGitInfo,
  resolveApiUrl,
  resolveToken,
} from "../ci-env";
import { formatCounts } from "../format";
import { ENV } from "../reference";
import { waitForFinalize } from "../upload";

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
  const apiUrl = resolveApiUrl(env);
  const buildName = options.buildName ?? env[ENV.buildName] ?? "default";
  const nonce = options.nonce ?? env[ENV.nonce] ?? defaultNonce(env);
  if (nonce === null) {
    throw new Error("Set --nonce to the nonce the shards used.");
  }
  const git = options.skipIfEmpty
    ? await readGitInfo(
        env,
        process.cwd(),
        options.baselineBranch ?? env[ENV.baselineBranch],
      )
    : undefined;

  let build: { buildId: string; buildNumber: number; url: string };
  let final: Awaited<ReturnType<typeof waitForFinalize>>;
  try {
    const api = createApiClient({
      baseUrl: apiUrl,
      token: await resolveToken(env),
      refreshToken: env[ENV.token] ? undefined : () => resolveToken(env),
    });
    build = await api.request("POST", "/builds/finalize", {
      buildName,
      nonce,
      ...((options.nonce ?? env[ENV.nonce])
        ? {}
        : { previousNonces: previousNonces(env) }),
      skipIfEmpty: options.skipIfEmpty,
      git,
      ci: readCiInfo(env),
    });
    final = await waitForFinalize(api, build.buildId, true);
  } catch (error) {
    if (error instanceof ForkPullRequestError && !options.strict) {
      console.warn(
        `stateofpixel: skipped, ${error.message} Use --strict to fail instead.`,
      );
      return;
    }
    if (isRateLimited(error) && !options.strict) {
      console.warn(
        `stateofpixel: skipped, ${error.message} Use --strict to fail instead.`,
      );
      return;
    }
    if (isServerError(error) && !options.strict) {
      console.warn(
        `stateofpixel: skipped, the service at ${apiUrl} is not reachable (${error instanceof Error ? error.message : error}). Use --strict to fail instead.`,
      );
      return;
    }
    if (error instanceof ApiError) {
      throw new Error(`${error.message} (${error.code}) from ${apiUrl}`);
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
