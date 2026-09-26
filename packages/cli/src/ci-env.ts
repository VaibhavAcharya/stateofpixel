import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { ApiError, retryServerErrors } from "./api";

const execFileAsync = promisify(execFile);
const MAX_ANCESTORS = 100;
const OIDC_AUDIENCE = "stateofpixel";

export type Env = Record<string, string | undefined>;

export type GitInfo = {
  commit: string;
  commitMessage: string;
  branch: string;
  baselineBranch: string;
  prNumber: number | null;
  mergeBase: string | null;
  ancestors: string[];
};

export type CiInfo = { provider?: string; runUrl?: string };

type GithubEvent = {
  pull_request?: {
    number: number;
    head: { sha: string; ref: string; repo?: { full_name: string } | null };
    base: { ref: string };
  };
  head_commit?: { message: string } | null;
  repository?: { default_branch?: string; full_name?: string };
};

export class ForkPullRequestError extends Error {}

export async function readGitInfo(
  env: Env,
  cwd: string,
  baselineBranchOverride?: string,
): Promise<GitInfo> {
  const event = await readGithubEvent(env);
  const pullRequest = event?.pull_request;
  const commit =
    pullRequest?.head.sha ||
    env.GITHUB_SHA ||
    (await git(cwd, "rev-parse", "HEAD"));
  if (commit === null) {
    throw new Error("Could not find the commit. Run inside a git checkout.");
  }
  const branch =
    pullRequest?.head.ref ||
    env.GITHUB_HEAD_REF ||
    env.GITHUB_REF_NAME ||
    (await git(cwd, "rev-parse", "--abbrev-ref", "HEAD")) ||
    "HEAD";
  const baselineBranch =
    baselineBranchOverride ||
    pullRequest?.base.ref ||
    event?.repository?.default_branch ||
    (await defaultBranch(cwd)) ||
    "main";

  return {
    commit,
    commitMessage:
      (await git(cwd, "log", "-1", "--format=%s", commit)) ??
      event?.head_commit?.message?.split("\n")[0] ??
      "",
    branch,
    baselineBranch,
    prNumber: pullRequest?.number ?? null,
    mergeBase: await git(cwd, "merge-base", commit, `origin/${baselineBranch}`),
    ancestors: await ancestors(cwd, commit),
  };
}

export function readCiInfo(env: Env): CiInfo {
  if (env.GITHUB_ACTIONS === "true") {
    return {
      provider: "github-actions",
      runUrl:
        env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
          ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
          : undefined,
    };
  }
  return env.CI ? { provider: "unknown" } : {};
}

export function defaultNonce(env: Env): string | null {
  if (env.GITHUB_RUN_ID) {
    return `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT ?? "1"}`;
  }
  return null;
}

export async function resolveToken(
  env: Env,
  fetchImpl: typeof fetch = fetch,
  retryDelayMs = 1000,
): Promise<string> {
  if (env.STATEOFPIXEL_TOKEN) {
    return env.STATEOFPIXEL_TOKEN;
  }
  const requestUrl = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    if (isForkPullRequest(await readGithubEvent(env))) {
      throw new ForkPullRequestError(
        "GitHub Actions gives no OIDC token to pull requests from forks.",
      );
    }
    throw new Error(
      "No token. On GitHub Actions add `permissions: id-token: write`, elsewhere set STATEOFPIXEL_TOKEN.",
    );
  }
  const url = new URL(requestUrl);
  url.searchParams.set("audience", OIDC_AUDIENCE);
  return retryServerErrors(
    async () => {
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${requestToken}` },
      });
      if (!response.ok) {
        throw new ApiError(
          response.status,
          "oidc_failed",
          `GitHub Actions OIDC token request failed with HTTP ${response.status}.`,
        );
      }
      const { value } = (await response.json()) as { value: string };
      return value;
    },
    3,
    retryDelayMs,
  );
}

function isForkPullRequest(event: GithubEvent | null): boolean {
  const headRepo = event?.pull_request?.head.repo?.full_name;
  return headRepo !== undefined && headRepo !== event?.repository?.full_name;
}

async function readGithubEvent(env: Env): Promise<GithubEvent | null> {
  if (!env.GITHUB_EVENT_PATH) {
    return null;
  }
  try {
    return JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function ancestors(cwd: string, commit: string): Promise<string[]> {
  for (const start of [commit, "HEAD"]) {
    const output = await git(
      cwd,
      "rev-list",
      `--max-count=${MAX_ANCESTORS + 2}`,
      start,
    );
    if (output !== null) {
      return output
        .split("\n")
        .filter((sha) => sha !== "" && sha !== commit)
        .slice(start === "HEAD" ? 1 : 0)
        .slice(0, MAX_ANCESTORS);
    }
  }
  return [];
}

async function defaultBranch(cwd: string): Promise<string | null> {
  const ref = await git(
    cwd,
    "symbolic-ref",
    "--short",
    "refs/remotes/origin/HEAD",
  );
  return ref?.replace(/^origin\//, "") ?? null;
}

async function git(cwd: string, ...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}
