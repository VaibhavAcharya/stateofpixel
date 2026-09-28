/// <reference types="vite/client" />
import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { api as functions, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAILY_BUILDS, DAILY_UPLOAD_BYTES } from "./lib/limits";
import { hashProjectToken } from "./lib/projectTokens";
import { messages, sign, verify } from "./lib/signing";
import { rateLimiter as limits } from "./rateLimits";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TOKEN = `sop_${"t".repeat(43)}`;
const IMAGE_SECRET = "test-image-secret";
const BLOB_UPLOAD_URL = "https://stateofpixel.test/api/v1/uploads/";

type Test = ReturnType<typeof convexTest>;

let compareStatus = "ahead";
let compareCalls: string[] = [];
let commitPulls: Record<
  string,
  { number: number; merged_at: string | null; base: { ref: string } }[]
> = {};
let checkCalls: {
  method: string;
  path: string;
  body: Record<string, unknown>;
}[] = [];
let blobDeletes: string[] = [];

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("SITE_URL", "https://stateofpixel.test");
  vi.stubEnv("IMAGE_URL_SECRET", IMAGE_SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", await exportPKCS8(privateKey));
});

beforeEach(() => {
  vi.useFakeTimers();
  compareStatus = "ahead";
  compareCalls = [];
  commitPulls = {};
  checkCalls = [];
  blobDeletes = [];
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const { host, pathname } = new URL(input);
    if (host === "stateofpixel.test" && init?.method === "DELETE") {
      blobDeletes.push(pathname.slice("/api/v1/uploads/".length));
      return new Response(null, { status: 204 });
    }
    if (pathname.startsWith("/repos/acme/web-app/statuses/")) {
      checkCalls.push({
        method: init?.method ?? "GET",
        path: pathname,
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ id: 555 }, { status: 201 });
    }
    if (pathname === "/app/installations/10/access_tokens") {
      return Response.json({ token: "ghs_installation" });
    }
    const compare = /^\/repos\/acme\/web-app\/compare\/(.+)$/.exec(pathname);
    if (compare?.[1] !== undefined) {
      compareCalls.push(compare[1]);
      return Response.json({ status: compareStatus });
    }
    const pulls = /^\/repos\/acme\/web-app\/commits\/(.+)\/pulls$/.exec(
      pathname,
    );
    if (pulls?.[1] !== undefined && commitPulls[pulls[1]] !== undefined) {
      return Response.json(commitPulls[pulls[1]]);
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function setup({ imageStore }: { imageStore?: "convex" | "blobs" } = {}) {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const tokenHash = await hashProjectToken(TOKEN);
  const accountId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      githubUserId: 42,
      login: "octocat",
      githubToken: "ghu_user",
      lastSeenAt: 0,
    });
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 10 * 1024 ** 3,
      storageBytes: 0,
      imageStore,
    });
    const projectId = await ctx.db.insert("projects", {
      accountId,
      githubRepoId: 100,
      owner: "acme",
      name: "web-app",
      private: true,
      defaultBranch: "main",
      autoApproveBranches: ["main"],
      diffThreshold: 0.1,
      diffIncludeAA: false,
      prRetentionDays: 30,
      nextBuildNumber: 1,
    });
    await ctx.db.insert("projectTokens", {
      projectId,
      name: "ci",
      tokenHash,
      createdBy: userId,
    });
    return accountId;
  });
  return { t, accountId };
}

async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function api(t: Test, method: string, path: string, body?: unknown) {
  const response = await t.fetch(`/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  await runDueJobs(t);
  return { status: response.status, body: await response.json() };
}

async function runDueJobs(t: Test) {
  for (let i = 0; i < 5; i++) {
    vi.advanceTimersByTime(1);
    await t.finishInProgressScheduledFunctions();
  }
}

type Image = { name: string; content: string };

async function snapshotsOf(images: Image[]) {
  return Promise.all(
    images.map(async ({ name, content }) => ({
      name,
      hash: await sha256(content),
      width: 10,
      height: 10,
    })),
  );
}

async function store(t: Test, content: string) {
  return t.run((ctx) => ctx.storage.store(new Blob([content])));
}

async function upload(uploadUrl: string, content: string) {
  const url = new URL(uploadUrl);
  const blobKey = url.pathname.slice("/api/v1/uploads/".length);
  const hash = url.searchParams.get("hash") ?? "";
  const exp = Number(url.searchParams.get("exp"));
  expect(
    await verify(
      IMAGE_SECRET,
      messages.upload(blobKey, hash, exp),
      url.searchParams.get("sig") ?? "",
    ),
  ).toBe(true);
  const bytes = new TextEncoder().encode(content).byteLength;
  const sig = await sign(IMAGE_SECRET, messages.stored(blobKey, hash, bytes));
  return {
    blobKey,
    storageId: `blob.${blobKey.split("/")[1]}.${bytes}.${sig}`,
  };
}

async function runBuild(
  t: Test,
  {
    commit,
    ancestors = [],
    images,
    changed = [],
    prNumber,
    nonce = commit,
  }: {
    commit: string;
    ancestors?: string[];
    images: Image[];
    changed?: string[];
    prNumber?: number;
    nonce?: string;
  },
) {
  const snapshots = await snapshotsOf(images);
  const created = await api(t, "POST", "/builds", {
    nonce,
    shard: { index: 1, total: 1 },
    git: {
      commit,
      commitMessage: `Commit ${commit}\n\nBody`,
      branch: prNumber === undefined ? "main" : "feature",
      baselineBranch: "main",
      prNumber,
      ancestors,
    },
    snapshots,
  });
  expect(created.status).toBe(200);

  const uploads = [];
  for (const [index, snapshot] of created.body.snapshots.entries()) {
    const image = images[index] as Image;
    if (snapshot.uploadUrl !== undefined) {
      uploads.push({
        hash: await sha256(image.content),
        storageId: snapshot.uploadUrl.startsWith(BLOB_UPLOAD_URL)
          ? (await upload(snapshot.uploadUrl, image.content)).storageId
          : await store(t, image.content),
        kind: "screenshot",
        width: 10,
        height: 10,
      });
    }
  }
  const completed = await api(
    t,
    "POST",
    `/builds/${created.body.buildId}/shards/1/complete`,
    {
      uploads,
      results: snapshots.map((snapshot) => ({
        name: snapshot.name,
        hash: snapshot.hash,
        status: changed.includes(snapshot.name) ? "changed" : "unchanged",
      })),
    },
  );
  expect(completed.status).toBe(200);
  const build = await api(t, "GET", `/builds/${created.body.buildId}`);
  return {
    created: created.body,
    completed: completed.body,
    build: build.body,
  };
}

it("rejects requests without a valid token", async () => {
  const { t } = await setup();
  const response = await t.fetch("/api/v1/builds", {
    method: "POST",
    body: "{}",
  });
  expect(response.status).toBe(401);
});

it("rejects an invalid body", async () => {
  const { t } = await setup();
  const response = await api(t, "POST", "/builds", { nonce: "1" });
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("invalid_request");
});

it("auto-approves the first build as the baseline", async () => {
  const { t, accountId } = await setup();
  const { created, build } = await runBuild(t, {
    commit: "c1",
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Footer", content: "footer-v1" },
    ],
  });

  expect(created).toMatchObject({
    buildNumber: 1,
    url: "https://stateofpixel.test/acme/web-app/builds/1",
    diff: { threshold: 0.1, includeAA: false },
    baseline: null,
  });
  expect(
    created.snapshots.map((s: { status: string; uploadUrl?: string }) => [
      s.status,
      typeof s.uploadUrl,
    ]),
  ).toEqual([
    ["added", "string"],
    ["added", "string"],
  ]);
  expect(build).toMatchObject({
    status: "finalized",
    conclusion: "approved",
    counts: { added: 2, approved: 2, pending: 0 },
    shards: { done: 1, total: 1 },
  });
  const account = await t.run((ctx) => ctx.db.get("accounts", accountId));
  expect(account?.storageBytes).toBe(18);
});

it("compares a build against the nearest approved ancestor", async () => {
  const { t, accountId: setupAccountId } = await setup({
    imageStore: "blobs",
  });
  await runBuild(t, {
    commit: "c1",
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Footer", content: "footer-v1" },
      { name: "Sidebar", content: "sidebar-v1" },
    ],
  });

  const { created, build } = await runBuild(t, {
    commit: "c2",
    ancestors: ["c1b", "c1"],
    prNumber: 7,
    images: [
      { name: "Header", content: "header-v2" },
      { name: "Footer", content: "footer-v1" },
      { name: "Promo", content: "promo-v1" },
    ],
    changed: ["Header"],
  });

  expect(created.baseline).toEqual({ buildNumber: 1, commit: "c1" });
  expect(
    created.snapshots.map(
      (s: {
        name: string;
        status: string;
        uploadUrl?: string;
        baselineUrl?: string;
      }) => ({
        name: s.name,
        status: s.status,
        upload: s.uploadUrl !== undefined,
        baseline: s.baselineUrl !== undefined,
      }),
    ),
  ).toEqual([
    { name: "Header", status: "changed", upload: true, baseline: true },
    { name: "Footer", status: "unchanged", upload: false, baseline: false },
    { name: "Promo", status: "added", upload: true, baseline: false },
  ]);
  const baselineUrl = new URL(
    created.snapshots.find((s: { name: string }) => s.name === "Header")
      .baselineUrl,
  );
  const [, projectId, accountId] =
    /^\/api\/images\/([a-z0-9]+)\/([a-z0-9]+)\.[0-9a-f-]{36}$/.exec(
      baselineUrl.pathname,
    ) ?? [];
  expect(baselineUrl.origin).toBe("https://stateofpixel.test");
  expect(accountId).toBe(setupAccountId);
  const exp = Number(baselineUrl.searchParams.get("exp"));
  expect(
    await verify(
      IMAGE_SECRET,
      messages.grant(projectId ?? "", setupAccountId, exp),
      baselineUrl.searchParams.get("sig") ?? "",
    ),
  ).toBe(true);
  expect(build).toMatchObject({
    status: "finalized",
    conclusion: "changes",
    counts: {
      unchanged: 1,
      changed: 1,
      added: 1,
      removed: 1,
      pending: 2,
      approved: 0,
    },
  });
});

it("tags images with their project and whether the default branch uses them", async () => {
  const { t } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    prNumber: 7,
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Promo", content: "promo-v1" },
    ],
  });
  await runBuild(t, {
    commit: "c3",
    ancestors: ["c1"],
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Footer", content: "footer-v1" },
    ],
  });

  const tags = await t.run(async (ctx) => {
    const project = await ctx.db.query("projects").unique();
    const images = await ctx.db.query("images").collect();
    return Object.fromEntries(
      images.map((image) => [
        image.hash,
        [image.projectId === project?._id, image.baseline],
      ]),
    );
  });
  expect(tags).toEqual({
    [await sha256("header-v1")]: [true, true],
    [await sha256("promo-v1")]: [true, false],
    [await sha256("footer-v1")]: [true, true],
  });
});

it("asks GitHub for a baseline when no ancestor has a build", async () => {
  const { t } = await setup();
  const images = [{ name: "Header", content: "header-v1" }];
  await runBuild(t, { commit: "c1", images });
  expect(compareCalls).toEqual([]);

  const shallow = await runBuild(t, { commit: "c2", images, prNumber: 7 });
  expect(compareCalls).toEqual(["c1...c2"]);
  expect(shallow.created.baseline).toEqual({ buildNumber: 1, commit: "c1" });
  expect(shallow.build.counts).toMatchObject({ unchanged: 1 });

  compareStatus = "diverged";
  const unrelated = await runBuild(t, { commit: "c3", images, prNumber: 8 });
  expect(unrelated.created.baseline).toBeNull();
});

it("treats byte-different but pixel-identical images as unchanged", async () => {
  const { t } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  const { build } = await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    images: [{ name: "Header", content: "header-v1-recompressed" }],
  });
  expect(build).toMatchObject({
    conclusion: "no_changes",
    counts: { unchanged: 1 },
  });
});

it("marks earlier builds of the same PR as superseded", async () => {
  const { t } = await setup();
  const images = [{ name: "Header", content: "header-v1" }];
  const first = await runBuild(t, { commit: "c1", images, prNumber: 7 });
  await runBuild(t, { commit: "c2", images, prNumber: 7 });
  const superseded = await t.run((ctx) =>
    ctx.db.get("builds", first.created.buildId as Id<"builds">),
  );
  expect(superseded?.supersededById).toBeDefined();
});

it("joins shards by nonce and finalizes after the last one", async () => {
  const { t } = await setup();
  const [header, footer] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
    { name: "Footer", content: "footer-v1" },
  ]);
  const shard = (index: number, snapshot: typeof header) =>
    api(t, "POST", "/builds", {
      nonce: "run-1",
      shard: { index, total: 2 },
      git: {
        commit: "c1",
        branch: "main",
        baselineBranch: "main",
        ancestors: [],
      },
      snapshots: [snapshot],
    });
  const first = await shard(1, header);
  const second = await shard(2, footer);
  expect(second.body.buildId).toBe(first.body.buildId);

  const complete = async (index: number, name: string, content: string) =>
    api(t, "POST", `/builds/${first.body.buildId}/shards/${index}/complete`, {
      uploads: [
        {
          hash: await sha256(content),
          storageId: await store(t, content),
          kind: "screenshot",
          width: 10,
          height: 10,
        },
      ],
      results: [{ name, hash: await sha256(content), status: "added" }],
    });
  await complete(1, "Header", "header-v1");
  expect(
    (await api(t, "GET", `/builds/${first.body.buildId}`)).body.status,
  ).toBe("pending");
  await complete(2, "Footer", "footer-v1");
  expect(
    (await api(t, "GET", `/builds/${first.body.buildId}`)).body,
  ).toMatchObject({ status: "finalized", counts: { added: 2 } });

  const late = await shard(1, header);
  expect(late.status).toBe(409);
  expect(late.body.error.code).toBe("build_not_pending");
});

it("numbers auto shards and finalizes with the shards that arrived", async () => {
  const { t } = await setup();
  const git = {
    commit: "c1",
    branch: "main",
    baselineBranch: "main",
    ancestors: [],
  };
  const [header] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
  ]);
  const shard = () =>
    api(t, "POST", "/builds", {
      nonce: "auto-run",
      shard: { index: null, total: null },
      git,
      snapshots: [header],
    });
  const first = await shard();
  const second = await shard();
  expect(first.body.shardIndex).toBe(1);
  expect(second.body.shardIndex).toBe(2);
  expect(second.body.buildId).toBe(first.body.buildId);

  await api(t, "POST", `/builds/${first.body.buildId}/shards/1/complete`, {
    uploads: [
      {
        hash: header?.hash,
        storageId: await store(t, "header-v1"),
        kind: "screenshot",
        width: 10,
        height: 10,
      },
    ],
    results: [{ name: "Header", hash: header?.hash, status: "added" }],
  });
  expect(
    (await api(t, "GET", `/builds/${first.body.buildId}`)).body.status,
  ).toBe("pending");
  await api(t, "POST", "/builds/finalize", { nonce: "auto-run" });
  expect(
    (await api(t, "GET", `/builds/${first.body.buildId}`)).body,
  ).toMatchObject({
    status: "finalized",
    counts: { added: 1 },
    shards: { done: 1, total: null },
  });

  const fixed = await api(t, "POST", "/builds", {
    nonce: "fixed-run",
    shard: { index: null, total: 2 },
    git,
    snapshots: [],
  });
  expect(fixed.status).toBe(400);
  expect(fixed.body.error.code).toBe("invalid_shard");
});

it("creates an empty build on finalize only with skipIfEmpty", async () => {
  const { t } = await setup();
  const git = {
    commit: "c1",
    branch: "feat/header",
    baselineBranch: "main",
    prNumber: 7,
    ancestors: [],
  };
  const missing = await api(t, "POST", "/builds/finalize", { nonce: "none" });
  expect(missing.status).toBe(404);
  expect(missing.body.error.code).toBe("build_not_found");
  const noGit = await api(t, "POST", "/builds/finalize", {
    nonce: "none",
    skipIfEmpty: true,
  });
  expect(noGit.status).toBe(400);

  const empty = await api(t, "POST", "/builds/finalize", {
    nonce: "none",
    skipIfEmpty: true,
    git,
  });
  expect(empty.status).toBe(200);
  expect(
    (await api(t, "GET", `/builds/${empty.body.buildId}`)).body,
  ).toMatchObject({ status: "finalized", conclusion: "no_changes" });
  const build = await t.run((ctx) =>
    ctx.db.get("builds", empty.body.buildId as Id<"builds">),
  );
  expect(build).toMatchObject({ prNumber: 7, subset: true, fullRows: false });
  expect(lastCheck()).toMatchObject({
    state: "success",
    description: "No visual changes",
  });
});

it("marks a snapshot failed when the uploaded bytes do not match the hash", async () => {
  const { t } = await setup();
  const [header] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
  ]);
  const created = await api(t, "POST", "/builds", {
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    git: {
      commit: "c1",
      branch: "main",
      baselineBranch: "main",
      ancestors: [],
    },
    snapshots: [header],
  });
  const storageId = await store(t, "something else");
  const completed = await api(
    t,
    "POST",
    `/builds/${created.body.buildId}/shards/1/complete`,
    {
      uploads: [
        {
          hash: header?.hash,
          storageId,
          kind: "screenshot",
          width: 10,
          height: 10,
        },
      ],
      results: [{ name: "Header", hash: header?.hash, status: "added" }],
    },
  );
  expect(completed.body.rejectedUploads).toEqual([header?.hash]);
  const build = await api(t, "GET", `/builds/${created.body.buildId}`);
  expect(build.body).toMatchObject({
    conclusion: "changes",
    counts: { failed: 1 },
  });
  expect(
    await t.run((ctx) => ctx.db.system.get("_storage", storageId)),
  ).toBeNull();
});

it("finalizes on request and expires builds that never finish", async () => {
  const { t } = await setup();
  const git = {
    commit: "c1",
    branch: "main",
    baselineBranch: "main",
    ancestors: [],
  };
  const finalizeMode = await api(t, "POST", "/builds", {
    nonce: "finalize-mode",
    shard: { index: 1, total: null },
    git,
    snapshots: [],
  });
  const finalized = await api(t, "POST", "/builds/finalize", {
    nonce: "finalize-mode",
  });
  expect(finalized.status).toBe(200);
  expect(
    (await api(t, "GET", `/builds/${finalizeMode.body.buildId}`)).body,
  ).toMatchObject({ status: "finalized", conclusion: "no_changes" });

  const abandoned = await t.fetch("/api/v1/builds", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      nonce: "abandoned",
      shard: { index: 1, total: 2 },
      git,
      snapshots: [],
    }),
  });
  const { buildId } = await abandoned.json();
  expect((await api(t, "GET", `/builds/${buildId}`)).body.status).toBe(
    "pending",
  );
  vi.advanceTimersByTime(61 * 60 * 1000);
  await runDueJobs(t);
  expect((await api(t, "GET", `/builds/${buildId}`)).body.status).toBe(
    "expired",
  );
});

it("does not expose builds of other projects", async () => {
  const { t } = await setup();
  const response = await api(t, "GET", "/builds/not-an-id");
  expect(response.status).toBe(404);
});

function lastCheck() {
  const call = checkCalls[checkCalls.length - 1];
  return {
    path: call?.path,
    state: call?.body.state,
    description: call?.body.description,
  };
}

it("sets the GitHub commit status as the build moves", async () => {
  const { t } = await setup();
  const images = [
    { name: "Header", content: "header-v1" },
    { name: "Footer", content: "footer-v1" },
  ];
  await runBuild(t, { commit: "c1", images });
  expect(checkCalls[0]).toEqual({
    method: "POST",
    path: "/repos/acme/web-app/statuses/c1",
    body: {
      state: "pending",
      description: "Waiting for screenshots",
      target_url: "https://stateofpixel.test/acme/web-app/builds/1",
      context: "stateofpixel",
    },
  });
  expect(lastCheck()).toEqual({
    path: "/repos/acme/web-app/statuses/c1",
    state: "success",
    description: "Baseline created, 2 snapshots",
  });

  checkCalls = [];
  await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    prNumber: 7,
    images: [
      { name: "Header", content: "header-v2" },
      { name: "Footer", content: "footer-v1" },
    ],
    changed: ["Header"],
  });
  expect(lastCheck()).toEqual({
    path: "/repos/acme/web-app/statuses/c2",
    state: "pending",
    description: "1 change to review",
  });
});

it("retries a status that GitHub rejected", async () => {
  const { t } = await setup();
  vi.stubGlobal("fetch", async () => new Response("down", { status: 502 }));
  const { created } = await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  const outOfSync = await t.run((ctx) =>
    ctx.db.get("builds", created.buildId as Id<"builds">),
  );
  expect(outOfSync).toMatchObject({ checkOutOfSync: true });

  vi.stubGlobal("fetch", async (input: string | URL) => {
    const { pathname } = new URL(input);
    return pathname.endsWith("/access_tokens")
      ? Response.json({ token: "ghs_installation" })
      : Response.json({ id: 777 }, { status: 201 });
  });
  await t.mutation(internal.checks.retryOutOfSync, {});
  await runDueJobs(t);
  const synced = await t.run((ctx) =>
    ctx.db.get("builds", created.buildId as Id<"builds">),
  );
  expect(synced).toMatchObject({ checkOutOfSync: false });
});

it("does not retry a status that GitHub cannot accept", async () => {
  const { t } = await setup();
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const { pathname } = new URL(input);
    if (pathname.endsWith("/access_tokens")) {
      return Response.json({ token: "ghs_installation" });
    }
    checkCalls.push({ method: "POST", path: pathname, body: {} });
    return new Response("No commit found", { status: 422 });
  });
  const { created } = await runBuild(t, {
    commit: "not-on-github",
    images: [{ name: "Header", content: "header-v1" }],
  });
  const build = await t.run((ctx) =>
    ctx.db.get("builds", created.buildId as Id<"builds">),
  );
  expect(build?.checkOutOfSync).toBe(false);

  checkCalls = [];
  vi.advanceTimersByTime(10 * 60 * 1000);
  await t.mutation(internal.checks.retryOutOfSync, {});
  await runDueJobs(t);
  expect(checkCalls).toEqual([]);
});

it("auto-approves builds on the default branch", async () => {
  const { t } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  const main = await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    images: [
      { name: "Header", content: "header-v2" },
      { name: "Promo", content: "promo-v1" },
    ],
    changed: ["Header"],
  });
  expect(main.build).toMatchObject({
    conclusion: "approved",
    counts: { changed: 1, added: 1, pending: 0, approved: 2 },
  });
  expect(lastCheck()).toMatchObject({
    state: "success",
    description: "Baseline updated, 2 changes",
  });
  const sources = await t.run(async (ctx) =>
    (await ctx.db.query("reviews").collect()).map((review) => review.source),
  );
  expect(sources.filter((source) => source === "auto_branch")).toHaveLength(2);

  const next = await runBuild(t, {
    commit: "c3",
    ancestors: ["c2", "c1"],
    prNumber: 9,
    images: [{ name: "Header", content: "header-v2" }],
  });
  expect(next.created.baseline).toEqual({ buildNumber: 2, commit: "c2" });
});

async function reviewer(t: Test) {
  const userId = await t.run(async (ctx) => {
    const user = await ctx.db.query("users").first();
    const project = await ctx.db.query("projects").first();
    if (user === null || project === null) {
      throw new Error("setup missing");
    }
    await ctx.db.insert("repoPermissions", {
      userId: user._id,
      projectId: project._id,
      permission: "write",
      orgOwner: false,
      checkedAt: Date.now(),
      freshness: "fresh",
    });
    return user._id;
  });
  const user = t.withIdentity({ subject: `${userId}|session` });
  const snapshot = async (buildNumber: number, name: string) => {
    const row = await t.run(async (ctx) => {
      const build = (await ctx.db.query("builds").collect()).find(
        (item) => item.number === buildNumber,
      );
      return (await ctx.db.query("snapshots").collect()).find(
        (item) => item.buildId === build?._id && item.name === name,
      );
    });
    if (row === undefined) {
      throw new Error(`No snapshot ${name} in build ${buildNumber}`);
    }
    return user.query(functions.snapshots.get, {
      owner: "acme",
      name: "web-app",
      number: buildNumber,
      snapshotId: row._id,
    });
  };
  const review = async (
    buildNumber: number,
    name: string,
    action: "approve" | "reject" | "undo",
  ) => {
    const target = await snapshot(buildNumber, name);
    if (target === null) {
      throw new Error("snapshot not readable");
    }
    await user.mutation(functions.reviews.apply, {
      buildId: target.buildId,
      snapshotIds: [target.id],
      action,
    });
    await runDueJobs(t);
  };
  return { user, snapshot, review };
}

it("carries approvals over to new builds of the same PR", async () => {
  const { t } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Footer", content: "footer-v1" },
    ],
  });
  const images = [
    { name: "Header", content: "header-v2" },
    { name: "Footer", content: "footer-v2" },
  ];
  const changed = ["Header", "Footer"];
  const first = await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    prNumber: 7,
    images,
    changed,
  });
  expect(first.build.counts).toMatchObject({ pending: 2, approved: 0 });
  const { snapshot, review } = await reviewer(t);
  await review(2, "Header", "approve");
  await review(2, "Footer", "reject");

  const second = await runBuild(t, {
    commit: "c3",
    ancestors: ["c2", "c1"],
    prNumber: 7,
    images,
    changed,
  });
  expect(second.build).toMatchObject({
    conclusion: "changes",
    counts: { pending: 1, approved: 1, rejected: 0 },
  });
  expect(await snapshot(3, "Header")).toMatchObject({
    reviewState: "approved",
    lastReview: {
      source: "carry_over",
      carriedFrom: { buildNumber: 2, login: "octocat" },
    },
  });
  expect(await snapshot(3, "Footer")).toMatchObject({
    reviewState: "pending",
    rejectedIn: 2,
  });

  await review(3, "Header", "undo");
  const third = await runBuild(t, {
    commit: "c4",
    ancestors: ["c3", "c2", "c1"],
    prNumber: 7,
    images,
    changed,
  });
  expect(third.build.counts).toMatchObject({ pending: 2, approved: 0 });
});

it("links a squash-merged main build to its PR", async () => {
  const { t } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  const images = [
    { name: "Header", content: "header-v2" },
    { name: "Promo", content: "promo-v1" },
  ];
  await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    prNumber: 7,
    images,
    changed: ["Header"],
  });
  const { user, snapshot, review } = await reviewer(t);
  await review(2, "Header", "approve");

  commitPulls.s1 = [
    { number: 7, merged_at: "2026-09-25T10:00:00Z", base: { ref: "main" } },
  ];
  const main = await runBuild(t, {
    commit: "s1",
    ancestors: ["s1", "c1"],
    images,
    changed: ["Header"],
  });
  expect(main.build.conclusion).toBe("approved");
  const build = await user.query(functions.builds.get, {
    owner: "acme",
    name: "web-app",
    number: 3,
  });
  expect(build?.mergedPr).toEqual({ number: 7, lastBuildNumber: 2 });
  expect(await snapshot(3, "Header")).toMatchObject({
    notReviewedOnPr: false,
  });
  expect(await snapshot(3, "Promo")).toMatchObject({ notReviewedOnPr: true });
});

const LIMIT_BYTES = 10 * 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

it("warns in CI when storage is near the limit", async () => {
  const { t, accountId } = await setup();
  await t.run((ctx) =>
    ctx.db.patch("accounts", accountId, { storageBytes: LIMIT_BYTES * 0.85 }),
  );
  const { created } = await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  expect(created.warnings).toEqual(["Storage at 85% of the 10 GB limit."]);
});

it("keeps storing images during the grace period", async () => {
  const { t, accountId } = await setup();
  await t.run((ctx) =>
    ctx.db.patch("accounts", accountId, { storageBytes: LIMIT_BYTES }),
  );
  const startedAt = Date.now();
  const { created, build } = await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  expect(created.snapshots[0].uploadUrl).toEqual(expect.any(String));
  expect(created.warnings).toEqual([
    `Storage limit of 10 GB reached. From ${new Date(startedAt + 14 * DAY_MS).toISOString().slice(0, 10)}, new images are not stored. Lower retention in project settings to free space.`,
  ]);
  expect(build.conclusion).toBe("approved");
  const account = await t.run((ctx) => ctx.db.get("accounts", accountId));
  expect(account?.overLimitSince).toBeGreaterThanOrEqual(startedAt);
});

it("stops storing new images after the grace period", async () => {
  const { t, accountId } = await setup();
  await runBuild(t, {
    commit: "c1",
    images: [
      { name: "Header", content: "header-v1" },
      { name: "Footer", content: "footer-v1" },
    ],
  });
  await t.run((ctx) =>
    ctx.db.patch("accounts", accountId, {
      storageBytes: LIMIT_BYTES,
      overLimitSince: Date.now() - 15 * DAY_MS,
    }),
  );

  checkCalls = [];
  const { created, build } = await runBuild(t, {
    commit: "c2",
    ancestors: ["c1"],
    prNumber: 7,
    images: [
      { name: "Header", content: "header-v2" },
      { name: "Footer", content: "footer-v1" },
      { name: "Promo", content: "promo-v1" },
    ],
    changed: ["Header"],
  });
  expect(created.snapshots).toEqual([
    { name: "Header", hash: expect.any(String), status: "changed" },
    { name: "Footer", hash: expect.any(String), status: "unchanged" },
    { name: "Promo", hash: expect.any(String), status: "added" },
  ]);
  expect(created.warnings).toEqual([
    "Storage limit of 10 GB reached. New images are not stored, so changes are not compared. Lower retention in project settings to free space.",
  ]);
  expect(build).toMatchObject({
    conclusion: "changes",
    counts: { unchanged: 1, changed: 1, added: 1, failed: 0, pending: 0 },
  });
  expect(lastCheck()).toMatchObject({
    state: "success",
    description: "Storage limit reached, not compared",
  });

  const next = await runBuild(t, {
    commit: "c3",
    ancestors: ["c2", "c1"],
    images: [{ name: "Header", content: "header-v1" }],
  });
  expect(next.created.baseline).toEqual({ buildNumber: 1, commit: "c1" });
});

it("enforces the build limits", async () => {
  const { t } = await setup();
  const git = {
    commit: "c1",
    branch: "main",
    baselineBranch: "main",
    ancestors: [],
  };
  const [header] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
  ]);

  const longName = await api(t, "POST", "/builds", {
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    git,
    snapshots: [{ ...header, name: "x".repeat(513) }],
  });
  expect(longName.body.error.code).toBe("snapshot_name_too_long");

  const shards = await api(t, "POST", "/builds", {
    nonce: "run-2",
    shard: { index: 1, total: 257 },
    git,
    snapshots: [header],
  });
  expect(shards.body.error.code).toBe("invalid_shard");

  const created = await api(t, "POST", "/builds", {
    nonce: "run-3",
    shard: { index: 1, total: 1 },
    git,
    snapshots: [header],
  });
  const completed = await api(
    t,
    "POST",
    `/builds/${created.body.buildId}/shards/1/complete`,
    {
      uploads: [
        {
          hash: header?.hash,
          storageId: await store(t, "header-v1"),
          kind: "screenshot",
          width: 10,
          height: 50_001,
        },
      ],
      results: [{ name: "Header", hash: header?.hash, status: "added" }],
    },
  );
  expect(completed.body.rejectedUploads).toEqual([header?.hash]);
});

it("rate limits requests per token", async () => {
  const { t } = await setup();
  const key = `token:${await hashProjectToken(TOKEN)}`;
  await t.run((ctx) => limits.limit(ctx, "ciRequests", { key, count: 600 }));
  const response = await api(t, "GET", "/whoami");
  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe("rate_limited");
});

it("limits builds and uploaded bytes per account per day", async () => {
  const { t, accountId } = await setup();
  const git = {
    commit: "c1",
    branch: "main",
    baselineBranch: "main",
    ancestors: [],
  };
  const create = (nonce: string) =>
    api(t, "POST", "/builds", {
      nonce,
      shard: { index: 1, total: 1 },
      git,
      snapshots: [],
    });

  await t.run((ctx) =>
    limits.limit(ctx, "builds", { key: accountId, count: DAILY_BUILDS }),
  );
  const builds = await create("run-1");
  expect(builds.status).toBe(429);
  expect(builds.body.error.code).toBe("build_limit_reached");

  await t.run(async (ctx) => {
    await limits.reset(ctx, "builds", { key: accountId });
    await limits.limit(ctx, "uploadedBytes", {
      key: accountId,
      count: DAILY_UPLOAD_BYTES + 1,
      reserve: true,
    });
  });
  const uploads = await create("run-2");
  expect(uploads.status).toBe(429);
  expect(uploads.body.error.code).toBe("upload_limit_reached");
});

async function uploadTargets(t: Test, buildId: string, hash: string) {
  const targets = await api(t, "POST", `/builds/${buildId}/upload-urls`, {
    hashes: [hash],
  });
  return targets.body.uploads[0].uploadUrl as string;
}

it("stores uploads in Blobs and deletes a duplicate blob of the same image", async () => {
  const { t, accountId } = await setup({ imageStore: "blobs" });
  const [header] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
  ]);
  const hash = header?.hash ?? "";
  const created = await api(t, "POST", "/builds", {
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    git: {
      commit: "c1",
      branch: "main",
      baselineBranch: "main",
      ancestors: [],
    },
    snapshots: [header],
  });
  const buildId = created.body.buildId;
  const first = await upload(created.body.snapshots[0].uploadUrl, "header-v1");
  const second = await upload(
    await uploadTargets(t, buildId, hash),
    "header-v1",
  );
  expect(first.blobKey).toMatch(new RegExp(`^${accountId}/[0-9a-f-]{36}$`));
  expect(second.blobKey).not.toBe(first.blobKey);

  const completed = await api(
    t,
    "POST",
    `/builds/${buildId}/shards/1/complete`,
    {
      uploads: [first, second].map(({ storageId }) => ({
        hash,
        storageId,
        kind: "screenshot",
        width: 10,
        height: 10,
      })),
      results: [{ name: "Header", hash, status: "added" }],
    },
  );
  expect(completed.body.rejectedUploads).toEqual([]);
  expect(blobDeletes).toEqual([second.blobKey]);
  const images = await t.run((ctx) => ctx.db.query("images").collect());
  expect(images).toMatchObject([
    { hash, store: "blobs", blobKey: first.blobKey, bytes: 9 },
  ]);
});

it("rejects a Blobs receipt that the upload route did not sign", async () => {
  const { t } = await setup({ imageStore: "blobs" });
  const [header] = await snapshotsOf([
    { name: "Header", content: "header-v1" },
  ]);
  const created = await api(t, "POST", "/builds", {
    nonce: "run-1",
    shard: { index: 1, total: 1 },
    git: {
      commit: "c1",
      branch: "main",
      baselineBranch: "main",
      ancestors: [],
    },
    snapshots: [header],
  });
  const { storageId } = await upload(
    created.body.snapshots[0].uploadUrl,
    "header-v1",
  );
  const completed = await api(
    t,
    "POST",
    `/builds/${created.body.buildId}/shards/1/complete`,
    {
      uploads: [
        {
          hash: header?.hash,
          storageId: storageId.replace(/\.9\./, ".8."),
          kind: "screenshot",
          width: 10,
          height: 10,
        },
      ],
      results: [{ name: "Header", hash: header?.hash, status: "added" }],
    },
  );
  expect(completed.body.rejectedUploads).toEqual([header?.hash]);
  expect(await t.run((ctx) => ctx.db.query("images").collect())).toEqual([]);
});

it("hands out Convex upload URLs unless the account picked Blobs", async () => {
  for (const imageStore of [undefined, "convex", "blobs"] as const) {
    const { t } = await setup({ imageStore });
    const [header] = await snapshotsOf([
      { name: "Header", content: "header-v1" },
    ]);
    const created = await api(t, "POST", "/builds", {
      nonce: "run-1",
      shard: { index: 1, total: 1 },
      git: {
        commit: "c1",
        branch: "main",
        baselineBranch: "main",
        ancestors: [],
      },
      snapshots: [header],
    });
    expect(
      created.body.snapshots[0].uploadUrl.startsWith(BLOB_UPLOAD_URL),
    ).toBe(imageStore === "blobs");
  }
});
