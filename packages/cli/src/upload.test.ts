import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { ApiClient, CreateBuildResponse } from "./api";
import { parseShard } from "./commands/upload";
import { createPixelmatchEngine } from "./diff/pixelmatch";
import { sha256 } from "./png";
import { blackSquare, encodePng, writeFixture } from "./test/png-fixtures";
import { uploadDirectory } from "./upload";

const white = encodePng(40, 30);
const recompressed = encodePng(40, 30, undefined, 0);
const changed = encodePng(40, 30, blackSquare(10));

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "stateofpixel-upload-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function fakeApi(lookups: CreateBuildResponse["snapshots"], shardIndex = 1) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const uploaded: Buffer[] = [];
  const api: ApiClient = {
    async request<Result>(method: string, requestPath: string, body?: unknown) {
      calls.push({ method, path: requestPath, body });
      const responses: Record<string, unknown> = {
        "POST /builds": {
          buildId: "b1",
          buildNumber: 2,
          shardIndex,
          url: "https://stateofpixel.test/acme/web/builds/2",
          diff: { threshold: 0.1, includeAA: false },
          baseline: { buildNumber: 1, commit: "c1" },
          snapshots: lookups,
          warnings: [],
        },
        "POST /builds/b1/upload-urls": {
          uploads: ((body as { hashes: string[] })?.hashes ?? []).map(
            (hash) => ({
              hash,
              uploadUrl: `upload:${hash}`,
            }),
          ),
        },
        [`POST /builds/b1/shards/${shardIndex}/complete`]: {
          rejectedUploads: [],
        },
        "GET /builds/b1": {
          status: "finalized",
          shards: { done: 1, total: 1 },
          counts: {},
        },
      };
      return responses[`${method} ${requestPath}`] as Result;
    },
    async upload(uploadUrl: string, bytes: Buffer) {
      uploaded.push(bytes);
      return `storage-${uploadUrl}`;
    },
    async download(url: string) {
      return { "baseline:white": white }[url] as Buffer;
    },
  };
  return { api, calls, uploaded };
}

it("uploads missing images once and diffs changed snapshots", async () => {
  const dir = path.join(root, "shots");
  await writeFixture(dir, "same", white);
  await writeFixture(dir, "copy-of-new", changed);
  await writeFixture(dir, "nested/new", changed);
  await writeFixture(dir, "recompressed", recompressed);
  await writeFixture(dir, "changed", changed);

  const { api, calls, uploaded } = fakeApi([
    {
      name: "changed",
      status: "changed",
      baselineUrl: "baseline:white",
      uploadUrl: "u-changed",
    },
    { name: "copy-of-new", status: "added", uploadUrl: "u-changed" },
    { name: "nested/new", status: "added", uploadUrl: "u-changed" },
    {
      name: "recompressed",
      status: "changed",
      baselineUrl: "baseline:white",
      uploadUrl: "u-recompressed",
    },
    { name: "same", status: "unchanged" },
  ]);

  const output = await uploadDirectory({
    dir,
    workDir: root,
    api,
    engine: createPixelmatchEngine(),
    buildName: "default",
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    subset: false,
    git: {
      commit: "c2",
      commitMessage: "Change",
      branch: "feature",
      baselineBranch: "main",
      prNumber: 7,
      mergeBase: null,
      ancestors: ["c1"],
    },
    ci: {},
  });

  const create = calls[0]?.body as {
    snapshots: { name: string; hash: string }[];
  };
  expect(create.snapshots.map((snapshot) => snapshot.name)).toEqual([
    "changed",
    "copy-of-new",
    "nested/new",
    "recompressed",
    "same",
  ]);
  expect(create.snapshots[0]?.hash).toBe(sha256(changed));

  const statuses = Object.fromEntries(
    output.results.map((result) => [result.name, result.status]),
  );
  expect(statuses).toEqual({
    changed: "changed",
    "copy-of-new": "added",
    "nested/new": "added",
    recompressed: "unchanged",
    same: "unchanged",
  });
  const changedResult = output.results.find(
    (result) => result.name === "changed",
  );
  expect(changedResult?.diffPixels).toBe(100);

  expect(uploaded).toHaveLength(3);
  const complete = calls.find((call) => call.path.endsWith("/complete"))
    ?.body as {
    uploads: { kind: string; hash: string }[];
  };
  expect(complete.uploads.map((upload) => upload.kind).sort()).toEqual([
    "diff",
    "screenshot",
    "screenshot",
  ]);
  expect(complete.uploads.find((upload) => upload.kind === "diff")?.hash).toBe(
    changedResult?.diffHash,
  );
  expect(output.final?.status).toBe("finalized");
  expect(output.failedUploads).toEqual([]);
});

it("completes the shard index the server assigned in auto mode", async () => {
  const dir = path.join(root, "shots");
  await writeFixture(dir, "same", white);
  const { api, calls } = fakeApi([{ name: "same", status: "unchanged" }], 3);

  const output = await uploadDirectory({
    dir,
    workDir: root,
    api,
    engine: createPixelmatchEngine(),
    buildName: "default",
    nonce: "run-1",
    shard: parseShard("auto"),
    subset: false,
    git: {
      commit: "c2",
      commitMessage: "Change",
      branch: "feature",
      baselineBranch: "main",
      prNumber: 7,
      mergeBase: null,
      ancestors: ["c1"],
    },
    ci: {},
  });

  expect(calls[0]?.body).toMatchObject({ shard: { index: null, total: null } });
  expect(calls.map((call) => call.path)).toContain(
    "/builds/b1/shards/3/complete",
  );
  expect(output.failedUploads).toEqual([]);
});

it("sends metadata from a sidecar file with the result", async () => {
  const dir = path.join(root, "shots");
  await writeFixture(dir, "same", white);
  await writeFixture(dir, "plain", white);
  await writeFile(
    path.join(dir, "same.meta.json"),
    JSON.stringify({ browser: "chromium", viewport: 1280 }),
  );
  const { api, calls } = fakeApi([
    { name: "plain", status: "unchanged" },
    { name: "same", status: "unchanged" },
  ]);

  await uploadDirectory({
    dir,
    workDir: root,
    api,
    engine: createPixelmatchEngine(),
    buildName: "default",
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    subset: false,
    git: {
      commit: "c2",
      commitMessage: "Change",
      branch: "feature",
      baselineBranch: "main",
      prNumber: 7,
      mergeBase: null,
      ancestors: ["c1"],
    },
    ci: {},
  });

  const complete = calls.find((call) => call.path.endsWith("/complete"))
    ?.body as { results: object[] };
  expect(complete).toMatchObject({
    results: [
      { name: "plain", status: "unchanged" },
      {
        name: "same",
        status: "unchanged",
        metadata: { browser: "chromium", viewport: 1280 },
      },
    ],
  });
  expect(complete.results[0]).not.toHaveProperty("metadata");
});
