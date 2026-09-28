/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const emptyCounts = {
  unchanged: 0,
  changed: 0,
  added: 0,
  removed: 0,
  failed: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

async function insertProject(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 25 * 1024 ** 3,
      storageBytes: 0,
    });
    return ctx.db.insert("projects", {
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
  });
}

it("stores a build and its snapshots", async () => {
  const t = convexTest(schema, modules);
  const projectId = await insertProject(t);

  const snapshots = await t.run(async (ctx) => {
    const buildId = await ctx.db.insert("builds", {
      projectId,
      number: 1,
      buildName: "default",
      commitSha: "d4e5f6",
      commitMessage: "New header",
      branch: "feat/header",
      baselineBranch: "main",
      ancestors: ["0a1b2c"],
      prNumber: 88,
      nonce: "8123456789-1",
      shardsTotal: 1,
      doneShardIndexes: [],
      subset: false,
      status: "pending",
      autoApproved: false,
      fullRows: true,
      counts: emptyCounts,
      storageBlocked: false,
      checkVersion: 0,
      checkOutOfSync: false,
    });
    await ctx.db.insert("snapshots", {
      buildId,
      shardIndex: 1,
      name: "Header/Default [chromium 1280]",
      diffStatus: "added",
      reviewState: "pending",
      metadata: { browser: "chromium", viewport: 1280 },
    });
    return ctx.db
      .query("snapshots")
      .withIndex("by_buildId_and_diffStatus_and_name", (q) =>
        q.eq("buildId", buildId).eq("diffStatus", "added"),
      )
      .take(10);
  });

  expect(snapshots.map((snapshot) => snapshot.name)).toEqual([
    "Header/Default [chromium 1280]",
  ]);
});

it("rejects a snapshot with an unknown diff status", async () => {
  const t = convexTest(schema, modules);
  const projectId = await insertProject(t);

  await expect(
    t.run(async (ctx) => {
      const buildId = await ctx.db.insert("builds", {
        projectId,
        number: 1,
        buildName: "default",
        commitSha: "d4e5f6",
        commitMessage: "New header",
        branch: "main",
        baselineBranch: "main",
        ancestors: [],
        nonce: "1",
        doneShardIndexes: [],
        subset: false,
        status: "pending",
        autoApproved: false,
        fullRows: true,
        counts: emptyCounts,
        storageBlocked: false,
        checkVersion: 0,
        checkOutOfSync: false,
      });
      await ctx.db.insert("snapshots", {
        buildId,
        shardIndex: 1,
        name: "Button",
        // @ts-expect-error testing runtime validation
        diffStatus: "different",
        reviewState: "none",
        metadata: {},
      });
    }),
  ).rejects.toThrow();
});
