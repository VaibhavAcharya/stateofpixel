import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./api.ts";
import type { Id } from "./dataModel.ts";
import { one } from "./db/index.ts";
import {
  accountMembers,
  builds,
  images,
  snapshots,
  usageDaily,
} from "./schema.ts";
import { testBackend } from "./test/backend.ts";
import { insertAccount, insertProject, insertUser } from "./test/fixtures.ts";

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
  const t = testBackend();
  const ids = await t.run(async (ctx) => {
    const userId = await insertUser(ctx, {
      githubUserId: 42,
      login: "octocat",
      githubToken: "ghu_user",
    });
    const accountId = await insertAccount(ctx, {
      providerAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 10 * 1024 ** 3,
      storageBytes: 1111,
    });
    const membership = one(
      await ctx.db
        .insert(accountMembers)
        .values({ accountId, userId, role: "owner" })
        .returning({ _id: accountMembers._id }),
    );
    const projectId = await insertProject(ctx, accountId, {
      providerRepoId: 100,
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
    return { userId, accountId, membershipId: membership._id, projectId };
  });
  const insertBuild = (number: number, branch: string, prNumber?: number) =>
    t.run(
      async (ctx) =>
        one(
          await ctx.db
            .insert(builds)
            .values({
              _creationTime: Date.now(),
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
            })
            .returning({ _id: builds._id }),
        )._id,
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
    t.run(
      async (ctx) =>
        one(
          await ctx.db
            .insert(images)
            .values({
              _creationTime: Date.now(),
              accountId: ids.accountId,
              hash,
              kind: "screenshot",
              bytes,
              width: 10,
              height: 10,
              blobKey: `${ids.accountId}/${hash}`,
              lastReferencedAt: Date.now(),
              ...fields,
            })
            .returning({ _id: images._id }),
        )._id,
    );
  const insertSnapshot = (
    buildId: Id<"builds">,
    name: string,
    imageId: Id<"images">,
    diffImageId?: Id<"images">,
  ) =>
    t.run((ctx) =>
      ctx.db.insert(snapshots).values({
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
  await t.runAllJobs();

  const rows = await t.run((ctx) => ctx.db.select().from(usageDaily));
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
  const imageRows = await t.run((ctx) => ctx.db.select().from(images));
  expect(
    Object.fromEntries(
      imageRows.map((image) => [image.hash, image.baseline ?? null]),
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
      await ctx.db.insert(usageDaily).values({
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
  const owner = t.withUser(userId);

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
    ctx.db
      .update(accountMembers)
      .set({ role: "member" })
      .where(eq(accountMembers._id, membershipId)),
  );
  expect(
    await owner.query(api.usage.get, { login: "acme", since: "2026-01-01" }),
  ).toBeNull();
});
