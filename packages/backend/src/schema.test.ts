import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { one } from "./db/index.ts";
import { builds, snapshots } from "./schema.ts";
import { testBackend } from "./test/backend.ts";
import { insertAccount, insertProject } from "./test/fixtures.ts";

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

async function setupProject(t: ReturnType<typeof testBackend>) {
  return t.run(async (ctx) => {
    const accountId = await insertAccount(ctx, {
      storageLimitBytes: 25 * 1024 ** 3,
    });
    return insertProject(ctx, accountId);
  });
}

it("stores a build and its snapshots", async () => {
  const t = testBackend();
  const projectId = await setupProject(t);

  const rows = await t.run(async (ctx) => {
    const { _id: buildId } = one(
      await ctx.db
        .insert(builds)
        .values({
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
        })
        .returning({ _id: builds._id }),
    );
    await ctx.db.insert(snapshots).values({
      buildId,
      shardIndex: 1,
      name: "Header/Default [chromium 1280]",
      diffStatus: "added",
      reviewState: "pending",
      metadata: { browser: "chromium", viewport: 1280 },
    });
    return ctx.db
      .select()
      .from(snapshots)
      .where(
        and(eq(snapshots.buildId, buildId), eq(snapshots.diffStatus, "added")),
      )
      .orderBy(snapshots.name)
      .limit(10);
  });

  expect(rows.map((snapshot) => snapshot.name)).toEqual([
    "Header/Default [chromium 1280]",
  ]);
});

it("rejects a snapshot with an unknown diff status", async () => {
  const t = testBackend();
  const projectId = await setupProject(t);

  await expect(
    t.run(async (ctx) => {
      const { _id: buildId } = one(
        await ctx.db
          .insert(builds)
          .values({
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
          })
          .returning({ _id: builds._id }),
      );
      // @ts-expect-error testing runtime validation
      await ctx.db.insert(snapshots).values({
        buildId,
        shardIndex: 1,
        name: "Button",
        diffStatus: "different",
        reviewState: "none",
        metadata: {},
      });
    }),
  ).rejects.toThrow();
});
