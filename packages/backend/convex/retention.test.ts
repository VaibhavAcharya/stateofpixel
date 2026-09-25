/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const counts = {
  unchanged: 0,
  changed: 0,
  added: 1,
  removed: 0,
  failed: 0,
  pending: 0,
  approved: 1,
  rejected: 0,
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 0,
      storageBytes: 30,
    });
    const projectId = await ctx.db.insert("projects", {
      accountId,
      githubRepoId: 100,
      owner: "acme",
      name: "web-app",
      private: true,
      defaultBranch: "main",
      autoApproveBranches: ["release/*"],
      diffThreshold: 0.1,
      diffIncludeAA: false,
      prRetentionDays: 30,
      nextBuildNumber: 1,
    });
    return { accountId, projectId };
  });
  let number = 0;
  const insertBuild = (fields: {
    branch: string;
    prNumber?: number;
    baselineBuildId?: Id<"builds">;
  }) =>
    t.run((ctx) =>
      ctx.db.insert("builds", {
        projectId: ids.projectId,
        number: ++number,
        buildName: "default",
        commitSha: `c${number}`,
        commitMessage: "Commit",
        baselineBranch: "main",
        ancestors: [],
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
        conclusion: "approved",
        ...fields,
      }),
    );
  const insertImage = (hash: string) =>
    t.run(async (ctx) =>
      ctx.db.insert("images", {
        accountId: ids.accountId,
        hash,
        kind: "screenshot",
        bytes: 10,
        width: 40,
        height: 30,
        store: "convex",
        storageId: await ctx.storage.store(new Blob(["png"])),
        lastReferencedAt: Date.now(),
      }),
    );
  const insertSnapshot = (
    buildId: Id<"builds">,
    imageId: Id<"images">,
    name = "Header",
  ) =>
    t.run(async (ctx) => {
      const snapshotId = await ctx.db.insert("snapshots", {
        buildId,
        shardIndex: 1,
        name,
        imageId,
        diffStatus: "added",
        reviewState: "approved",
        metadata: {},
      });
      const reviewId = await ctx.db.insert("reviews", {
        snapshotId,
        buildId,
        action: "approve",
        source: "user",
      });
      const build = await ctx.db.get("builds", buildId);
      if (build?.prNumber !== undefined) {
        await ctx.db.insert("approvedImages", {
          projectId: ids.projectId,
          buildName: "default",
          prNumber: build.prNumber,
          imageId,
          reviewId,
        });
      }
      return snapshotId;
    });
  const run = async (
    fn:
      | typeof internal.retention.deleteOldBuilds
      | typeof internal.retention.collectImages,
  ) => {
    await t.mutation(fn, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  };
  const buildNumbers = () =>
    t.run(async (ctx) =>
      (await ctx.db.query("builds").collect()).map((build) => build.number),
    );
  return {
    t,
    ...ids,
    insertBuild,
    insertImage,
    insertSnapshot,
    run,
    buildNumbers,
  };
}

it("marks the builds of a PR as closed and reopened", async () => {
  const { t, insertBuild } = await setup();
  const buildId = await insertBuild({ branch: "feature", prNumber: 7 });
  const closedAt = () =>
    t.run(
      async (ctx) => (await ctx.db.get("builds", buildId))?.prClosedAt ?? null,
    );

  await t.mutation(internal.retention.setPrClosed, {
    githubRepoId: 100,
    prNumber: 7,
    closed: true,
  });
  expect(await closedAt()).toBe(Date.now());

  await t.mutation(internal.retention.setPrClosed, {
    githubRepoId: 100,
    prNumber: 7,
    closed: false,
  });
  expect(await closedAt()).toBeNull();
});

it("deletes builds of PRs closed longer than the retention setting", async () => {
  const { t, insertBuild, insertImage, insertSnapshot, run, buildNumbers } =
    await setup();
  const main = await insertBuild({ branch: "main" });
  const release = await insertBuild({ branch: "release/1" });
  const closed = await insertBuild({
    branch: "old-feature",
    prNumber: 7,
    baselineBuildId: main,
  });
  const open = await insertBuild({ branch: "feature", prNumber: 8 });
  const imageId = await insertImage("h1");
  await insertSnapshot(closed, imageId);
  await insertSnapshot(open, imageId);
  await insertSnapshot(release, imageId);
  await t.mutation(internal.retention.setPrClosed, {
    githubRepoId: 100,
    prNumber: 7,
    closed: true,
  });

  vi.setSystemTime(Date.now() + 29 * DAY_MS);
  await insertBuild({ branch: "feature", prNumber: 8 });
  vi.setSystemTime(Date.now() + 2 * DAY_MS);
  await run(internal.retention.deleteOldBuilds);

  expect(await buildNumbers()).toEqual([1, 2, 4, 5]);
  const left = await t.run(async (ctx) => ({
    snapshots: (await ctx.db.query("snapshots").collect()).map(
      (snapshot) => snapshot.buildId,
    ),
    reviews: (await ctx.db.query("reviews").collect()).length,
    approvals: (await ctx.db.query("approvedImages").collect()).map(
      (approval) => approval.prNumber,
    ),
  }));
  expect(left).toEqual({
    snapshots: [open, release],
    reviews: 2,
    approvals: [8],
  });
});

it("deletes builds of branches without builds for the retention period", async () => {
  const { insertBuild, run, buildNumbers } = await setup();
  await insertBuild({ branch: "feature", prNumber: 7 });
  await insertBuild({ branch: "spike" });
  vi.setSystemTime(Date.now() + 20 * DAY_MS);
  await insertBuild({ branch: "spike" });
  vi.setSystemTime(Date.now() + 11 * DAY_MS);

  await run(internal.retention.deleteOldBuilds);

  expect(await buildNumbers()).toEqual([2, 3]);
});

it("keeps an old build that another build uses as its baseline", async () => {
  const { insertBuild, run, buildNumbers } = await setup();
  const first = await insertBuild({ branch: "feature", prNumber: 7 });
  await insertBuild({ branch: "main", baselineBuildId: first });
  vi.setSystemTime(Date.now() + 31 * DAY_MS);

  await run(internal.retention.deleteOldBuilds);

  expect(await buildNumbers()).toEqual([1, 2]);
});

it("deletes images that no snapshot uses after a day", async () => {
  const { t, accountId, insertBuild, insertImage, insertSnapshot, run } =
    await setup();
  const buildId = await insertBuild({ branch: "main" });
  const used = await insertImage("used");
  await insertImage("unused");
  await insertSnapshot(buildId, used);

  await run(internal.retention.collectImages);
  const hashes = () =>
    t.run(async (ctx) =>
      (await ctx.db.query("images").collect()).map((image) => image.hash),
    );
  expect(await hashes()).toEqual(["used", "unused"]);

  vi.setSystemTime(Date.now() + DAY_MS + 1);
  await run(internal.retention.collectImages);

  expect(await hashes()).toEqual(["used"]);
  const state = await t.run(async (ctx) => ({
    files: (await ctx.db.system.query("_storage").collect()).length,
    storageBytes: (await ctx.db.get("accounts", accountId))?.storageBytes,
  }));
  expect(state).toEqual({ files: 1, storageBytes: 20 });
});

it("deletes GitHub delivery ids older than a week", async () => {
  const { t } = await setup();
  await t.run((ctx) =>
    ctx.db.insert("githubEvents", { deliveryId: "old", event: "ping" }),
  );
  vi.setSystemTime(Date.now() + 8 * DAY_MS);
  await t.run((ctx) =>
    ctx.db.insert("githubEvents", { deliveryId: "new", event: "ping" }),
  );

  await t.mutation(internal.retention.cleanupEvents, {});

  const events = await t.run(async (ctx) =>
    (await ctx.db.query("githubEvents").collect()).map(
      (event) => event.deliveryId,
    ),
  );
  expect(events).toEqual(["new"]);
});
