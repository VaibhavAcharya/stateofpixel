import { asc, eq } from "drizzle-orm";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api.ts";
import { first, one } from "./db/index.ts";
import { accounts, builds, githubEvents, projects } from "./schema.ts";
import { type TestBackend, testBackend } from "./test/backend.ts";
import { insertUser } from "./test/fixtures.ts";

const WEBHOOK_SECRET = "test-webhook-secret";

type Repository = {
  id: number;
  name: string;
  private?: boolean;
  default_branch?: string;
};

let installationRepositories: Repository[] = [];

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_SLUG", "stateofpixel");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", await exportPKCS8(privateKey));
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

beforeEach(() => {
  vi.useFakeTimers();
  installationRepositories = [
    { id: 100, name: "web-app" },
    { id: 101, name: "design-system", private: false },
  ];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const { pathname } = new URL(input);
    if (pathname === "/app/installations/10") {
      return json({
        id: 10,
        account: { id: 1, login: "acme", type: "Organization" },
        suspended_at: null,
      });
    }
    if (pathname === "/app/installations/10/access_tokens") {
      return json({ token: "ghs_installation" });
    }
    if (pathname === "/installation/repositories") {
      return json({
        total_count: installationRepositories.length,
        repositories: installationRepositories.map(toGithubRepository),
      });
    }
    if (pathname === "/user/installations") {
      return json({
        total_count: 1,
        installations: [
          {
            id: 10,
            account: { id: 1, login: "acme", type: "Organization" },
            suspended_at: null,
          },
        ],
      });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function toGithubRepository(repository: Repository) {
  return {
    id: repository.id,
    name: repository.name,
    owner: { login: "acme" },
    private: repository.private ?? true,
    default_branch: repository.default_branch ?? "main",
  };
}

async function sign(body: string, secret = WEBHOOK_SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return `sha256=${[...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function deliver(
  t: TestBackend,
  event: string,
  payload: unknown,
  deliveryId: string = crypto.randomUUID(),
  secret = WEBHOOK_SECRET,
) {
  const body = JSON.stringify(payload);
  const response = await t.fetch("/api/github/webhook", {
    method: "POST",
    headers: {
      "X-GitHub-Event": event,
      "X-GitHub-Delivery": deliveryId,
      "X-Hub-Signature-256": await sign(body, secret),
    },
    body,
  });
  await t.runAllJobs();
  return response;
}

async function listProjects(t: TestBackend) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .select()
        .from(projects)
        .orderBy(asc(projects.providerRepoId))
        .limit(100)
    ).map((project) => ({
      name: project.name,
      archived: project.archivedAt !== null,
    })),
  );
}

async function firstAccount(t: TestBackend) {
  return t.run(async (ctx) =>
    first(await ctx.db.select().from(accounts).limit(1)),
  );
}

it("rejects a delivery with a wrong signature", async () => {
  const t = testBackend();
  const response = await deliver(
    t,
    "installation",
    { action: "created", installation: { id: 10 } },
    undefined,
    "wrong-secret",
  );
  expect(response.status).toBe(401);
  expect(await listProjects(t)).toEqual([]);
});

it("creates the account and projects when the app is installed", async () => {
  const t = testBackend();
  const response = await deliver(t, "installation", {
    action: "created",
    installation: { id: 10 },
  });

  expect(response.status).toBe(204);
  const account = await firstAccount(t);
  expect(account).toMatchObject({
    login: "acme",
    type: "org",
    installationId: 10,
  });
  expect(await listProjects(t)).toEqual([
    { name: "web-app", archived: false },
    { name: "design-system", archived: false },
  ]);
});

it("handles each delivery once", async () => {
  const t = testBackend();
  const payload = { action: "created", installation: { id: 10 } };
  await deliver(t, "installation", payload, "delivery-1");
  await deliver(t, "installation", payload, "delivery-1");

  const events = await t.run((ctx) =>
    ctx.db.select().from(githubEvents).limit(10),
  );
  expect(events).toHaveLength(1);
});

it("archives projects removed from the installation", async () => {
  const t = testBackend();
  await deliver(t, "installation", {
    action: "created",
    installation: { id: 10 },
  });

  installationRepositories = [{ id: 100, name: "web-app" }];
  await deliver(t, "installation_repositories", {
    action: "removed",
    installation: { id: 10 },
  });

  expect(await listProjects(t)).toEqual([
    { name: "web-app", archived: false },
    { name: "design-system", archived: true },
  ]);
});

it("updates a renamed repository", async () => {
  const t = testBackend();
  await deliver(t, "installation", {
    action: "created",
    installation: { id: 10 },
  });

  await deliver(t, "repository", {
    action: "renamed",
    installation: { id: 10 },
    repository: toGithubRepository({ id: 100, name: "web" }),
  });

  expect(await listProjects(t)).toContainEqual({
    name: "web",
    archived: false,
  });
});

it("archives everything when the app is uninstalled", async () => {
  const t = testBackend();
  await deliver(t, "installation", {
    action: "created",
    installation: { id: 10 },
  });

  await deliver(t, "installation", {
    action: "deleted",
    installation: { id: 10 },
  });

  const account = await firstAccount(t);
  expect(account?.installationId).toBeNull();
  expect((await listProjects(t)).every((project) => project.archived)).toBe(
    true,
  );
});

it("links a signed-in user to their installations", async () => {
  const t = testBackend();
  const userId = await t.run((ctx) =>
    insertUser(ctx, {
      githubUserId: 42,
      login: "octocat",
      githubToken: "ghu_user",
    }),
  );
  const user = t.withUser(userId);

  expect(await user.query(api.me.accounts, {})).toEqual([]);
  await user.action(api.me.refreshAccounts, {});

  expect(await user.query(api.me.accounts, {})).toEqual([
    {
      login: "acme",
      type: "org",
      installed: true,
      plan: "free",
    },
  ]);
  const projects = await user.query(api.accounts.projects, {
    login: "acme",
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(projects.page).toMatchObject([
    { owner: "acme", name: "design-system", private: false },
    { owner: "acme", name: "web-app", private: true },
  ]);
});

it("starts the retention clock when a PR closes", async () => {
  const t = testBackend();
  await deliver(t, "installation", {
    action: "created",
    installation: { id: 10 },
  });
  const buildId = await t.run(async (ctx) => {
    const project = first(await ctx.db.select().from(projects).limit(1));
    if (project === null) {
      throw new Error("No project");
    }
    const build = one(
      await ctx.db
        .insert(builds)
        .values({
          projectId: project._id,
          number: 1,
          buildName: "default",
          commitSha: "c1",
          commitMessage: "Commit",
          branch: "feature",
          baselineBranch: "main",
          ancestors: [],
          prNumber: 7,
          nonce: "n1",
          doneShardIndexes: [],
          subset: false,
          status: "finalized",
          autoApproved: false,
          fullRows: true,
          counts: {
            unchanged: 0,
            changed: 0,
            added: 0,
            removed: 0,
            failed: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
          },
          storageBlocked: false,
          checkVersion: 0,
          checkOutOfSync: false,
        })
        .returning({ _id: builds._id }),
    );
    return build._id;
  });

  await deliver(t, "pull_request", {
    action: "closed",
    installation: { id: 10 },
    repository: toGithubRepository({ id: 100, name: "web-app" }),
    pull_request: { number: 7 },
  });

  const build = await t.run(async (ctx) =>
    first(await ctx.db.select().from(builds).where(eq(builds._id, buildId))),
  );
  expect(build?.prClosedAt).toBe(Date.now());
});
