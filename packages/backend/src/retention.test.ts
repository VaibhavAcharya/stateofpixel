import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./api.ts";
import type { Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import {
  accounts,
  approvedImages,
  builds,
  deletedBuilds as deletedBuildsTable,
  githubEvents,
  images,
  reviews,
  snapshots,
} from "./schema.ts";
import { testBackend } from "./test/backend.ts";
import { insertAccount, insertProject } from "./test/fixtures.ts";

const blobs = new Set<string>();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  blobs.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
  const t = testBackend();
  const ids = await t.run(async (ctx) => {
    const accountId = await insertAccount(ctx, {
      providerAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 10 * 1024 ** 3,
      storageBytes: 30,
    });
    const projectId = await insertProject(ctx, accountId, {
      providerRepoId: 100,
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
    t.run(
      async (ctx) =>
        one(
          await ctx.db
            .insert(builds)
            .values({
              _creationTime: Date.now(),
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
            })
            .returning({ _id: builds._id }),
        )._id,
    );
  const insertImage = (hash: string) =>
    t.run(async (ctx) => {
      const blobKey = `${ids.accountId}/${hash}`;
      blobs.add(blobKey);
      return one(
        await ctx.db
          .insert(images)
          .values({
            accountId: ids.accountId,
            hash,
            kind: "screenshot",
            bytes: 10,
            width: 40,
            height: 30,
            blobKey,
            lastReferencedAt: Date.now(),
          })
          .returning({ _id: images._id }),
      )._id;
    });
  const insertSnapshot = (
    buildId: Id<"builds">,
    imageId: Id<"images">,
    name = "Header",
  ) =>
    t.run(async (ctx) => {
      const snapshotId = one(
        await ctx.db
          .insert(snapshots)
          .values({
            buildId,
            shardIndex: 1,
            name,
            imageId,
            diffStatus: "added",
            reviewState: "approved",
            metadata: {},
          })
          .returning({ _id: snapshots._id }),
      )._id;
      const reviewId = one(
        await ctx.db
          .insert(reviews)
          .values({
            snapshotId,
            buildId,
            action: "approve",
            source: "user",
          })
          .returning({ _id: reviews._id }),
      )._id;
      const build = first(
        await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
      );
      if (build !== null && build.prNumber !== null) {
        await ctx.db.insert(approvedImages).values({
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
    await t.runAllJobs();
  };
  const buildNumbers = () =>
    t.run(async (ctx) =>
      (await ctx.db.select().from(builds).orderBy(asc(builds.number))).map(
        (build) => build.number,
      ),
    );
  const deletedBuilds = () =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .select()
          .from(deletedBuildsTable)
          .orderBy(asc(deletedBuildsTable._creationTime))
      ).map(({ number, branch, prNumber, reason, retentionDays }) => ({
        number,
        branch,
        prNumber,
        reason,
        retentionDays,
      })),
    );
  return {
    t,
    ...ids,
    insertBuild,
    insertImage,
    insertSnapshot,
    run,
    buildNumbers,
    deletedBuilds,
  };
}

it("marks the builds of a PR as closed and reopened", async () => {
  const { t, insertBuild } = await setup();
  const buildId = await insertBuild({ branch: "feature", prNumber: 7 });
  const closedAt = () =>
    t.run(
      async (ctx) =>
        first(await ctx.db.select().from(builds).where(eq(builds._id, buildId)))
          ?.prClosedAt ?? null,
    );

  await t.mutation(internal.retention.setPrClosed, {
    providerRepoId: 100,
    prNumber: 7,
    closed: true,
  });
  expect(await closedAt()).toBe(Date.now());

  await t.mutation(internal.retention.setPrClosed, {
    providerRepoId: 100,
    prNumber: 7,
    closed: false,
  });
  expect(await closedAt()).toBeNull();
});

it("deletes builds of PRs closed longer than the retention setting", async () => {
  const {
    t,
    insertBuild,
    insertImage,
    insertSnapshot,
    run,
    buildNumbers,
    deletedBuilds,
  } = await setup();
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
    providerRepoId: 100,
    prNumber: 7,
    closed: true,
  });

  vi.setSystemTime(Date.now() + 29 * DAY_MS);
  await insertBuild({ branch: "feature", prNumber: 8 });
  vi.setSystemTime(Date.now() + 2 * DAY_MS);
  await run(internal.retention.deleteOldBuilds);

  expect(await buildNumbers()).toEqual([1, 2, 4, 5]);
  const left = await t.run(async (ctx) => ({
    snapshots: (await ctx.db.select().from(snapshots))
      .map((snapshot) => snapshot.buildId)
      .sort(),
    reviews: (await ctx.db.select().from(reviews)).length,
    approvals: (await ctx.db.select().from(approvedImages)).map(
      (approval) => approval.prNumber,
    ),
  }));
  expect(left).toEqual({
    snapshots: [open, release].sort(),
    reviews: 2,
    approvals: [8],
  });
  expect(await deletedBuilds()).toEqual([
    {
      number: 3,
      branch: "old-feature",
      prNumber: 7,
      reason: "pr_closed",
      retentionDays: 30,
    },
  ]);
});

it("deletes builds of branches without builds for the retention period", async () => {
  const { insertBuild, run, buildNumbers, deletedBuilds } = await setup();
  await insertBuild({ branch: "feature", prNumber: 7 });
  await insertBuild({ branch: "spike" });
  vi.setSystemTime(Date.now() + 20 * DAY_MS);
  await insertBuild({ branch: "spike" });
  vi.setSystemTime(Date.now() + 11 * DAY_MS);

  await run(internal.retention.deleteOldBuilds);

  expect(await buildNumbers()).toEqual([2, 3]);
  expect(await deletedBuilds()).toEqual([
    {
      number: 1,
      branch: "feature",
      prNumber: 7,
      reason: "branch_inactive",
      retentionDays: 30,
    },
  ]);
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
  vi.stubEnv(
    "NETLIFY_BLOBS_CONTEXT",
    btoa(
      JSON.stringify({
        siteID: "site",
        token: "token",
        apiURL: "https://blobs.test",
      }),
    ),
  );
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const { pathname } = new URL(input);
    if (init?.method === "delete") {
      blobs.delete(pathname.replace("/api/v1/blobs/site/site:images-dev/", ""));
    }
    return new Response(null, { status: 204 });
  });
  const { t, accountId, insertBuild, insertImage, insertSnapshot, run } =
    await setup();
  const buildId = await insertBuild({ branch: "main" });
  const used = await insertImage("used");
  await insertImage("unused");
  await insertSnapshot(buildId, used);

  await run(internal.retention.collectImages);
  const hashes = () =>
    t.run(async (ctx) =>
      (await ctx.db.select().from(images).orderBy(asc(images.hash))).map(
        (image) => image.hash,
      ),
    );
  expect(await hashes()).toEqual(["unused", "used"]);

  vi.setSystemTime(Date.now() + DAY_MS + 1);
  await run(internal.retention.collectImages);

  expect(await hashes()).toEqual(["used"]);
  const state = await t.run(async (ctx) => ({
    files: blobs.size,
    storageBytes: first(
      await ctx.db.select().from(accounts).where(eq(accounts._id, accountId)),
    )?.storageBytes,
  }));
  expect(state).toEqual({ files: 1, storageBytes: 20 });
});

it("deletes GitHub delivery ids older than a week", async () => {
  const { t } = await setup();
  await t.run((ctx) =>
    ctx.db
      .insert(githubEvents)
      .values({ deliveryId: "old", event: "ping", _creationTime: Date.now() }),
  );
  vi.setSystemTime(Date.now() + 8 * DAY_MS);
  await t.run((ctx) =>
    ctx.db
      .insert(githubEvents)
      .values({ deliveryId: "new", event: "ping", _creationTime: Date.now() }),
  );

  await t.mutation(internal.retention.cleanupEvents, {});

  const events = await t.run(async (ctx) =>
    (await ctx.db.select().from(githubEvents)).map((event) => event.deliveryId),
  );
  expect(events).toEqual(["new"]);
});
