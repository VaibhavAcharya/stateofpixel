import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { isServerError } from "./api";
import {
  defaultNonce,
  ForkPullRequestError,
  previousNonces,
  readGitInfo,
  resolveApiUrl,
  resolveToken,
} from "./ci-env";

let repo: string;
let commits: string[];

beforeAll(async () => {
  repo = await mkdtemp(path.join(tmpdir(), "stateofpixel-git-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const message of ["First", "Second", "Third\n\nBody"]) {
    git("commit", "-q", "--allow-empty", "-m", message);
  }
  commits = git("rev-list", "HEAD").split("\n");
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

it("reads git info from a local checkout", async () => {
  const info = await readGitInfo({}, repo);
  expect(info).toEqual({
    commit: commits[0],
    commitMessage: "Third",
    branch: "main",
    baselineBranch: "main",
    prNumber: null,
    mergeBase: null,
    ancestors: commits.slice(1),
  });
});

it("uses the PR head, not the merge commit, on pull_request runs", async () => {
  const eventPath = path.join(repo, "..", `event-${Date.now()}.json`);
  await writeFile(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 88,
        head: { sha: commits[1], ref: "feat/header" },
        base: { ref: "develop" },
      },
    }),
  );
  const info = await readGitInfo(
    {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_SHA: "merge-sha",
      GITHUB_REF_NAME: "88/merge",
    },
    repo,
  );
  expect(info).toMatchObject({
    commit: commits[1],
    commitMessage: "Second",
    branch: "feat/header",
    baselineBranch: "develop",
    prNumber: 88,
    ancestors: [commits[2]],
  });
  await rm(eventPath);
});

it("ignores empty GitHub env values on push runs", async () => {
  const info = await readGitInfo(
    {
      GITHUB_SHA: commits[0],
      GITHUB_HEAD_REF: "",
      GITHUB_REF_NAME: "main",
      GITHUB_BASE_REF: "",
    },
    repo,
  );
  expect(info).toMatchObject({
    commit: commits[0],
    branch: "main",
    baselineBranch: "main",
  });
});

it("builds the nonce from the GitHub run", () => {
  expect(defaultNonce({ GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" })).toBe(
    "123-2",
  );
  expect(defaultNonce({})).toBeNull();
});

it("lists the nonces of earlier attempts, newest first", () => {
  expect(
    previousNonces({ GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "3" }),
  ).toEqual(["123-2", "123-1"]);
  expect(
    previousNonces({ GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" }),
  ).toEqual([]);
  expect(previousNonces({})).toEqual([]);
});

it("requests a GitHub Actions OIDC token for the stateofpixel audience", async () => {
  let requested: URL | undefined;
  const token = await resolveToken(
    {
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://actions.test/token?api-version=2.0",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
    },
    async (input) => {
      requested = new URL(input as URL);
      return Response.json({ value: "oidc-jwt" });
    },
  );
  expect(token).toBe("oidc-jwt");
  expect(requested?.searchParams.get("audience")).toBe("stateofpixel");
  expect(requested?.searchParams.get("api-version")).toBe("2.0");
  expect(await resolveToken({ STATEOFPIXEL_TOKEN: "sop_x" })).toBe("sop_x");
});

it("uses STATEOFPIXEL_API_URL for a self-hosted server", () => {
  expect(resolveApiUrl({})).toBe("https://stateofpixel.com/api/v1");
  expect(resolveApiUrl({ STATEOFPIXEL_API_URL: "" })).toBe(
    "https://stateofpixel.com/api/v1",
  );
  expect(
    resolveApiUrl({
      STATEOFPIXEL_API_URL: "https://pixel.example.com/api/v1/",
    }),
  ).toBe("https://pixel.example.com/api/v1");
});

it("tells a pull request from a fork apart from a missing permission", async () => {
  const eventFor = async (headRepo: string) => {
    const eventPath = path.join(
      repo,
      `event-${headRepo.replace("/", "-")}.json`,
    );
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 7,
          head: { sha: "abc", ref: "patch-1", repo: { full_name: headRepo } },
          base: { ref: "main" },
        },
        repository: { full_name: "acme/web" },
      }),
    );
    return { GITHUB_EVENT_PATH: eventPath };
  };
  await expect(resolveToken(await eventFor("octocat/web"))).rejects.toThrow(
    ForkPullRequestError,
  );
  const sameRepo = resolveToken(await eventFor("acme/web"));
  await expect(sameRepo).rejects.toThrow("id-token: write");
  await expect(sameRepo).rejects.not.toThrow(ForkPullRequestError);
});

it("retries a failed OIDC token request, then treats it as a server error", async () => {
  const env = {
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://actions.test/token",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
  };
  let requests = 0;
  const error = await resolveToken(
    env,
    async () => {
      requests++;
      return new Response(null, { status: 503 });
    },
    0,
  ).catch((error: unknown) => error);
  expect(isServerError(error)).toBe(true);
  expect(requests).toBe(4);

  requests = 0;
  const token = await resolveToken(
    env,
    async () =>
      ++requests === 1
        ? new Response(null, { status: 503 })
        : Response.json({ value: "oidc-jwt" }),
    0,
  );
  expect(token).toBe("oidc-jwt");
});
