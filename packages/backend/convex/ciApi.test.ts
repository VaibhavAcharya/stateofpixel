/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashProjectToken } from "./lib/projectTokens";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const TOKEN = `sop_${"t".repeat(43)}`;

type Test = ReturnType<typeof convexTest>;

let compareStatus = "ahead";
let compareCalls: string[] = [];
let checkCalls: {
  method: string;
  path: string;
  body: Record<string, unknown>;
}[] = [];

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("SITE_URL", "https://stateofpixel.test");
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", await exportPKCS8(privateKey));
});

beforeEach(() => {
  vi.useFakeTimers();
  compareStatus = "ahead";
  compareCalls = [];
  checkCalls = [];
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const { pathname } = new URL(input);
    if (pathname.startsWith("/repos/acme/web-app/check-runs")) {
      checkCalls.push({
        method: init?.method ?? "GET",
        path: pathname,
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ id: 555 });
    }
    if (pathname === "/app/installations/10/access_tokens") {
      return Response.json({ token: "ghs_installation" });
    }
    const compare = /^\/repos\/acme\/web-app\/compare\/(.+)$/.exec(pathname);
    if (compare?.[1] !== undefined) {
      compareCalls.push(compare[1]);
      return Response.json({ status: compareStatus });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function setup() {
  const t = convexTest(schema, modules);
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
      storageLimitBytes: 0,
      storageBytes: 0,
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
        storageId: await store(t, image.content),
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
  const { t } = await setup();
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
    method: call?.method,
    path: call?.path,
    status: call?.body.status,
    conclusion: call?.body.conclusion,
    title: (call?.body.output as { title: string } | undefined)?.title,
  };
}

it("creates the GitHub check once and updates it as the build moves", async () => {
  const { t } = await setup();
  const images = [
    { name: "Header", content: "header-v1" },
    { name: "Footer", content: "footer-v1" },
  ];
  const first = await runBuild(t, { commit: "c1", images });
  expect(checkCalls[0]).toMatchObject({
    method: "POST",
    path: "/repos/acme/web-app/check-runs",
    body: {
      name: "stateofpixel",
      head_sha: "c1",
      external_id: first.created.buildId,
      status: "in_progress",
      details_url: "https://stateofpixel.test/acme/web-app/builds/1",
    },
  });
  expect(checkCalls.filter((call) => call.method === "POST")).toHaveLength(1);
  expect(lastCheck()).toEqual({
    method: "PATCH",
    path: "/repos/acme/web-app/check-runs/555",
    status: "completed",
    conclusion: "success",
    title: "Baseline created, 2 snapshots",
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
  expect(lastCheck()).toMatchObject({
    conclusion: "action_required",
    title: "1 change to review",
  });
  expect(checkCalls[checkCalls.length - 1]?.body.output).toMatchObject({
    summary: expect.stringContaining(
      "- changed: [Header](https://stateofpixel.test/acme/web-app/builds/2/snapshots/",
    ),
  });
});

it("retries a check that GitHub rejected", async () => {
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
  expect(outOfSync?.githubCheckRunId).toBeUndefined();

  vi.stubGlobal("fetch", async (input: string | URL) => {
    const { pathname } = new URL(input);
    return pathname.endsWith("/access_tokens")
      ? Response.json({ token: "ghs_installation" })
      : Response.json({ id: 777 });
  });
  await t.mutation(internal.checks.retryOutOfSync, {});
  await runDueJobs(t);
  const synced = await t.run((ctx) =>
    ctx.db.get("builds", created.buildId as Id<"builds">),
  );
  expect(synced).toMatchObject({
    checkOutOfSync: false,
    githubCheckRunId: 777,
  });
});

it("re-sends the check when GitHub asks for it", async () => {
  const { t } = await setup();
  const { created } = await runBuild(t, {
    commit: "c1",
    images: [{ name: "Header", content: "header-v1" }],
  });
  checkCalls = [];
  const body = JSON.stringify({
    action: "rerequested",
    installation: { id: 10 },
    check_run: { external_id: created.buildId },
  });
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", "secret");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = [
    ...new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const response = await t.fetch("/github/webhook", {
    method: "POST",
    headers: {
      "X-GitHub-Event": "check_run",
      "X-GitHub-Delivery": "delivery-1",
      "X-Hub-Signature-256": `sha256=${signature}`,
    },
    body,
  });
  expect(response.status).toBe(204);
  await runDueJobs(t);
  expect(lastCheck()).toMatchObject({
    method: "PATCH",
    conclusion: "success",
  });
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
    conclusion: "success",
    title: "Baseline updated, 2 changes",
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
