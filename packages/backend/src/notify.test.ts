import { eq } from "drizzle-orm";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./api.ts";
import { DAILY_BUILDS } from "./lib/limits.ts";
import { hashProjectToken } from "./lib/projectTokens.ts";
import { rateLimiter } from "./rateLimits.ts";
import { jobs, projectTokens } from "./schema.ts";
import { type TestBackend, testBackend } from "./test/backend.ts";
import { insertAccount, insertProject, insertUser } from "./test/fixtures.ts";

const NOTIFY_URL = "https://notify.test/api/notify";

let sent: { authorization: string | null; body: Record<string, unknown> }[] =
  [];
let notifyStatus = 200;

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://stateofpixel.test");
  vi.stubEnv("NOTIFY_URL", NOTIFY_URL);
  vi.stubEnv("NOTIFY_API_KEY", "notify-key");
  sent = [];
  notifyStatus = 200;
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    if (String(input) === NOTIFY_URL) {
      sent.push({
        authorization: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ status: "sent" }, { status: notifyStatus });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function scheduled(t: TestBackend) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .select({ args: jobs.args })
        .from(jobs)
        .where(eq(jobs.name, "notify.send"))
    ).map(({ args }) => args),
  );
}

it("sends a notification to the notify API", async () => {
  const t = testBackend();

  await t.action(internal.notify.send, {
    title: "New sign-up",
    message: "Ada",
  });

  expect(sent).toEqual([
    {
      authorization: "Bearer notify-key",
      body: { project: "stateofpixel", title: "New sign-up", message: "Ada" },
    },
  ]);
});

it("does not fail when the notify API drops a message for its rate limit", async () => {
  const t = testBackend();
  notifyStatus = 429;

  await expect(
    t.action(internal.notify.send, { title: "Test", message: "m" }),
  ).resolves.toBeNull();
});

it("schedules nothing when the notify API is not configured", async () => {
  const t = testBackend();
  vi.stubEnv("NOTIFY_URL", undefined);

  await t.mutation(internal.auth.userForIdentity, {
    identityId: "identity-1",
    name: "Ada",
  });

  expect(await scheduled(t)).toEqual([]);
});

it("notifies about a new sign-up once", async () => {
  const t = testBackend();
  const identity = {
    identityId: "identity-1",
    name: "Ada",
    email: "ada@example.com",
  };

  await t.mutation(internal.auth.userForIdentity, identity);
  vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
  await t.mutation(internal.auth.userForIdentity, identity);

  expect(await scheduled(t)).toEqual([
    { title: "New sign-up", message: "Ada, ada@example.com" },
  ]);
});

it("notifies when the GitHub App is installed on a new account only", async () => {
  const t = testBackend();
  const account = {
    installationId: 10,
    providerAccountId: 1,
    login: "acme",
    type: "org" as const,
  };

  await t.mutation(internal.installations.upsertAccount, account);
  await t.mutation(internal.installations.upsertAccount, {
    ...account,
    installationId: 11,
  });

  expect(await scheduled(t)).toEqual([
    {
      title: "GitHub App installed",
      message: "acme (org)",
      link: "https://github.com/acme",
    },
  ]);
});

it("notifies about the first build of a project only", async () => {
  const t = testBackend();
  const projectId = await t.run(async (ctx) =>
    insertProject(ctx, await insertAccount(ctx)),
  );
  const build = (nonce: string) =>
    t.mutation(internal.builds.createOrJoin, {
      projectId,
      buildName: "default",
      nonce,
      previousNonces: [],
      shardIndex: 1,
      shardsTotal: 1,
      subset: false,
      git: {
        commit: nonce,
        commitMessage: "",
        branch: "main",
        baselineBranch: "main",
        ancestors: [],
      },
    });

  await build("run-1");
  await build("run-2");

  expect(await scheduled(t)).toEqual([
    {
      title: "First build",
      message: "acme/web-app",
      link: "https://stateofpixel.test/acme/web-app/builds/1",
    },
  ]);
});

it("notifies when an account hits its daily build limit", async () => {
  const t = testBackend();
  const token = `sop_${"t".repeat(43)}`;
  const tokenHash = await hashProjectToken(token);
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    await exportPKCS8(
      (await generateKeyPair("RS256", { extractable: true })).privateKey,
    ),
  );
  await t.run(async (ctx) => {
    const userId = await insertUser(ctx, {
      githubUserId: 42,
      login: "octocat",
    });
    const accountId = await insertAccount(ctx);
    const projectId = await insertProject(ctx, accountId);
    await ctx.db
      .insert(projectTokens)
      .values({ projectId, name: "ci", tokenHash, createdBy: userId });
    await rateLimiter.limit(ctx, "builds", {
      key: accountId,
      count: DAILY_BUILDS,
    });
  });

  const response = await t.fetch("/api/v1/builds", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      nonce: "run-1",
      shard: { index: 1, total: 1 },
      git: {
        commit: "c1",
        branch: "main",
        baselineBranch: "main",
        ancestors: [],
      },
      snapshots: [],
    }),
  });

  expect(response.status).toBe(429);
  expect(await scheduled(t)).toEqual([
    {
      title: "Daily limit reached",
      message: "acme/web-app: build_limit_reached",
    },
  ]);
});

it("notifies about subscriptions that start, change, set to cancel and end", async () => {
  vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "test_mode");
  const t = testBackend();
  const accountId = await t.run((ctx) => insertAccount(ctx));
  const sync = (
    productId: string,
    status: string,
    cancelsAtPeriodEnd = false,
  ) =>
    t.mutation(internal.billing.syncSubscription, {
      accountId,
      subscriptionId: "sub_1",
      customerId: "cus_1",
      productId,
      status,
      periodEndsAt: Date.parse("2026-11-25T10:00:00Z"),
      cancelsAtPeriodEnd,
    });

  await sync("pdt_0NoN5TjZdBKHRU6UskUXu", "active");
  await sync("pdt_0NoN5TjZdBKHRU6UskUXu", "active");
  await sync("pdt_0NoN5ToBDApZ02O0BMR1K", "active");
  await sync("pdt_0NoN5ToBDApZ02O0BMR1K", "active", true);
  await sync("pdt_0NoN5ToBDApZ02O0BMR1K", "cancelled", true);

  const titles = (await scheduled(t)).map(
    (args) => (args as { title: string }).title,
  );
  expect(titles).toEqual([
    "New subscription",
    "Plan changed",
    "Subscription set to cancel",
    "Subscription ended",
  ]);
});

it("notifies when a job fails", async () => {
  const t = testBackend();
  await t.run((ctx) =>
    ctx.scheduler.runAfter(0, internal.installations.sync, {
      installationId: 10,
    }),
  );

  await t.runDueJobs();

  expect(sent).toHaveLength(1);
  expect(sent[0]?.body).toMatchObject({
    project: "stateofpixel",
    title: "Job failed",
  });
  expect(sent[0]?.body.message).toMatch(/^installations\.sync: /);
});
