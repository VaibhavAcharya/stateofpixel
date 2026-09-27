/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-02T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const counts = {
  unchanged: 1,
  changed: 1,
  added: 0,
  removed: 0,
  failed: 0,
  pending: 1,
  approved: 0,
  rejected: 0,
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
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
      storageBytes: 1111,
    });
    const membershipId = await ctx.db.insert("accountMembers", {
      accountId,
      userId,
      role: "owner",
    });
    const projectId = await ctx.db.insert("projects", {
      accountId,
      githubRepoId: 100,
      owner: "acme",
      name: "web-app",
      private: true,
      defaultBranch: "main",
      autoApproveBranches: [],
      diffThreshold: 0.1,
      diffIncludeAA: false,
      prRetentionDays: 30,
      nextBuildNumber: 3,
    });
    return { userId, accountId, membershipId, projectId };
  });
  const insertBuild = (number: number, branch: string, prNumber?: number) =>
    t.run((ctx) =>
      ctx.db.insert("builds", {
        projectId: ids.projectId,
        number,
        buildName: "default",
        commitSha: `c${number}`,
        commitMessage: "Commit",
        branch,
        baselineBranch: "main",
        ancestors: [],
        prNumber,
        doneShardIndexes: [1],
        shardsTotal: 1,
        subset: false,
        autoApproved: false,
        fullRows: true,
        counts,
        storageBlocked: false,
        checkVersion: 1,
        checkOutOfSync: false,
        nonce: `n${number}`,
        status: "finalized",
        conclusion: "changes",
      }),
    );
  const insertImage = (
    hash: string,
    bytes: number,
    fields: {
      kind?: "screenshot" | "diff";
      projectId?: Id<"projects">;
      baseline?: boolean;
    } = {},
  ) =>
    t.run((ctx) =>
      ctx.db.insert("images", {
        accountId: ids.accountId,
        hash,
        kind: "screenshot",
        bytes,
        width: 10,
        height: 10,
        store: "r2",
        r2Key: hash,
        lastReferencedAt: Date.now(),
        ...fields,
      }),
    );
  const insertSnapshot = (
    buildId: Id<"builds">,
    name: string,
    imageId: Id<"images">,
    diffImageId?: Id<"images">,
  ) =>
    t.run((ctx) =>
      ctx.db.insert("snapshots", {
        buildId,
        shardIndex: 1,
        name,
        imageId,
        diffImageId,
        diffStatus: diffImageId === undefined ? "unchanged" : "changed",
        reviewState: "none",
        metadata: {},
      }),
    );
  return { t, ...ids, insertBuild, insertImage, insertSnapshot };
}

it("counts storage per project and splits it into baselines, PR-only images and diffs", async () => {
  const { t, projectId, insertBuild, insertImage, insertSnapshot } =
    await setup();
  const main = await insertBuild(1, "main");
  const pr = await insertBuild(2, "feature", 7);
  const header = await insertImage("a", 100);
  const promo = await insertImage("b", 20);
  const diff = await insertImage("d", 3, { kind: "diff" });
  await insertImage("e", 1000, { projectId, baseline: true });
  await insertImage("unused", 5);
  await insertSnapshot(main, "Header", header);
  await insertSnapshot(pr, "Header", header);
  await insertSnapshot(pr, "Promo", promo, diff);

  await t.mutation(internal.usage.count, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const rows = await t.run((ctx) => ctx.db.query("usageDaily").collect());
  expect(rows).toMatchObject([
    {
      projectId,
      day: "2026-01-02",
      baselineBytes: 1100,
      prBytes: 20,
      diffBytes: 3,
      builds: 2,
      snapshots: 4,
      uploadedImages: 4,
    },
  ]);
  const images = await t.run((ctx) => ctx.db.query("images").collect());
  expect(
    Object.fromEntries(
      images.map((image) => [image.hash, image.baseline ?? null]),
    ),
  ).toEqual({ a: true, b: false, d: false, e: true, unused: null });
});

it("shows usage to account owners only", async () => {
  const { t, userId, membershipId, accountId, projectId } = await setup();
  await t.run(async (ctx) => {
    for (const [day, prBytes] of [
      ["2025-12-31", 10],
      ["2026-01-01", 20],
    ] as const) {
      await ctx.db.insert("usageDaily", {
        accountId,
        projectId,
        day,
        baselineBytes: 100,
        prBytes,
        diffBytes: 1,
        builds: 1,
        snapshots: 1,
        uploadedImages: 1,
      });
    }
  });
  const owner = t.withIdentity({ subject: `${userId}|session` });

  expect(
    await owner.query(api.usage.get, { login: "acme", since: "2026-01-01" }),
  ).toMatchObject({
    storage: { storageBytes: 1111 },
    countedOn: "2026-01-01",
    projects: [
      {
        name: "web-app",
        prRetentionDays: 30,
        baselineBytes: 100,
        prBytes: 20,
        diffBytes: 1,
      },
    ],
    daily: [{ day: "2026-01-01", bytes: 121 }],
  });

  await t.run((ctx) =>
    ctx.db.patch("accountMembers", membershipId, { role: "member" }),
  );
  expect(
    await owner.query(api.usage.get, { login: "acme", since: "2026-01-01" }),
  ).toBeNull();
});
