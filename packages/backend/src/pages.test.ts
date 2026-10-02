import { and, asc, count, eq, sql } from "drizzle-orm";
import { beforeAll, expect, it, vi } from "vitest";
import { api, internal } from "./api.ts";
import type { Id } from "./dataModel.ts";
import { database, first, one } from "./db/index.ts";
import { messages, PUBLIC_IMAGE_SCOPE, verify } from "./lib/signing.ts";
import {
  accountMembers,
  accounts,
  approvedImages,
  builds,
  deletedBuilds,
  images,
  projects,
  repoPermissions,
  reviews,
  snapshots,
} from "./schema.ts";
import { type TestBackend, testBackend } from "./test/backend.ts";
import { insertAccount, insertProject, insertUser } from "./test/fixtures.ts";

const SECRET = "test-image-secret";

beforeAll(() => {
  vi.stubEnv("IMAGE_URL_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://stateofpixel.test");
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

async function resetDatabase() {
  await database().execute(
    sql`do $$ begin execute (select 'truncate ' || string_agg(format('%I', tablename), ', ') from pg_tables where schemaname = 'public'); end $$`,
  );
}

async function setup({ private: isPrivate = true } = {}) {
  await resetDatabase();
  const t = testBackend();
  const ids = await t.run(async (ctx) => {
    const userId = await insertUser(ctx, {
      githubUserId: 42,
      login: "octocat",
      githubToken: "ghu_user",
    });
    const accountId = await insertAccount(ctx);
    await ctx.db.insert(accountMembers).values({ accountId, userId });
    const projectId = await insertProject(ctx, accountId, {
      private: isPrivate,
      nextBuildNumber: 3,
    });
    const base = {
      projectId,
      buildName: "default",
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
    };
    const { _id: baselineId } = one(
      await ctx.db
        .insert(builds)
        .values({
          ...base,
          number: 1,
          commitSha: "c1",
          branch: "main",
          nonce: "n1",
          status: "finalized",
          conclusion: "approved",
        })
        .returning({ _id: builds._id }),
    );
    const { _id: buildId } = one(
      await ctx.db
        .insert(builds)
        .values({
          ...base,
          number: 2,
          commitSha: "c2",
          branch: "feature",
          prNumber: 7,
          nonce: "n2",
          status: "finalized",
          conclusion: "changes",
          baselineBuildId: baselineId,
          browsers: ["chromium"],
        })
        .returning({ _id: builds._id }),
    );
    const { _id: imageId } = one(
      await ctx.db
        .insert(images)
        .values({
          accountId,
          hash: "h",
          kind: "screenshot",
          bytes: 3,
          width: 40,
          height: 30,
          blobKey: `${accountId}/h`,
          lastReferencedAt: 0,
        })
        .returning({ _id: images._id }),
    );
    const { _id: snapshotId } = one(
      await ctx.db
        .insert(snapshots)
        .values({
          buildId,
          shardIndex: 1,
          name: "Header",
          imageId,
          baselineImageId: imageId,
          diffStatus: "changed",
          diffRatio: 0.01,
          diffPixels: 12,
          reviewState: "pending",
          metadata: { browser: "chromium" },
        })
        .returning({ _id: snapshots._id }),
    );
    await ctx.db.insert(snapshots).values({
      buildId,
      shardIndex: 1,
      name: "Footer",
      imageId,
      diffStatus: "unchanged",
      reviewState: "none",
      metadata: {},
    });
    return { userId, projectId, buildId, snapshotId, imageId };
  });
  const user = t.withUser(ids.userId);
  const grant = (
    permission: "none" | "read" | "write" | "admin",
    freshness: "fresh" | "stale" | "expired" = "fresh",
  ) =>
    t.run((ctx) =>
      ctx.db.insert(repoPermissions).values({
        userId: ids.userId,
        projectId: ids.projectId,
        permission,
        orgOwner: false,
        checkedAt: Date.now(),
        freshness,
      }),
    );
  return { t, user, grant, ...ids };
}

const firstPage = { numItems: 50, cursor: null };
const repo = { owner: "acme", name: "web-app" };

it("asks for a permission check before showing a private project", async () => {
  const { user, grant, projectId } = await setup();
  expect(
    await user.query(api.projects.access, { owner: "acme", name: "web-app" }),
  ).toMatchObject({
    projectId,
    fresh: false,
    canRead: false,
  });
  expect(
    (await user.query(api.builds.list, { ...repo, paginationOpts: firstPage }))
      .page,
  ).toEqual([]);

  await grant("write");
  expect(
    await user.query(api.projects.access, { owner: "acme", name: "web-app" }),
  ).toMatchObject({
    fresh: true,
    canRead: true,
    canWrite: true,
  });
});

it("keeps a stale permission readable while it refreshes", async () => {
  const { t, user, userId, projectId } = await setup();
  vi.useFakeTimers();
  await t.mutation(internal.permissions.save, {
    userId,
    projectId,
    permission: "read",
    orgOwner: false,
  });
  const access = () => user.query(api.projects.access, repo);
  expect(await access()).toMatchObject({ fresh: true, canRead: true });

  vi.advanceTimersByTime(5 * 60 * 1000);
  await t.runDueJobs();
  expect(await access()).toMatchObject({ fresh: false, canRead: true });

  vi.advanceTimersByTime(10 * 60 * 1000);
  await t.runDueJobs();
  expect(await access()).toMatchObject({ fresh: false, canRead: false });

  await t.mutation(internal.permissions.save, {
    userId,
    projectId,
    permission: "read",
    orgOwner: false,
  });
  expect(await access()).toMatchObject({ fresh: true, canRead: true });
  vi.useRealTimers();
});

it("hides builds while a permission is expired or none", async () => {
  const { user, grant } = await setup();
  await grant("read", "expired");
  expect(
    (await user.query(api.builds.list, { ...repo, paginationOpts: firstPage }))
      .page,
  ).toEqual([]);
  expect(await user.query(api.builds.get, { ...repo, number: 2 })).toBeNull();

  const { user: other, grant: grantNone } = await setup();
  await grantNone("none");
  expect(
    (await other.query(api.builds.list, { ...repo, paginationOpts: firstPage }))
      .page,
  ).toEqual([]);
});

it("lets anyone read a public project", async () => {
  const { t } = await setup({ private: false });
  const page = await t.query(api.builds.list, {
    ...repo,
    paginationOpts: firstPage,
  });
  expect(page.page.map((build) => build.number)).toEqual([2, 1]);
});

it("lists builds by branch and returns build and snapshot details", async () => {
  const { user, grant, buildId, snapshotId } = await setup();
  await grant("read");

  const feature = await user.query(api.builds.list, {
    ...repo,
    branch: "feature",
    paginationOpts: firstPage,
  });
  expect(feature.page).toEqual([
    expect.objectContaining({
      number: 2,
      prNumber: 7,
      conclusion: "changes",
      superseded: false,
    }),
  ]);

  expect(
    await user.query(api.builds.get, { ...repo, number: 2 }),
  ).toMatchObject({
    buildId,
    baseline: { number: 1, branch: "main" },
    supersededBy: null,
    browsers: ["chromium"],
  });
  expect(await user.query(api.builds.get, { ...repo, number: 9 })).toBeNull();

  const changed = await user.query(api.snapshots.list, {
    buildId,
    diffStatus: "changed",
    paginationOpts: firstPage,
  });
  expect(changed.page).toEqual([
    {
      id: snapshotId,
      name: "Header",
      diffStatus: "changed",
      reviewState: "pending",
      diffRatio: 0.01,
      browser: "chromium",
    },
  ]);

  const detail = await user.query(api.snapshots.get, {
    ...repo,
    number: 2,
    snapshotId,
  });
  expect(detail).toMatchObject({
    name: "Header",
    diffPixels: 12,
    metadata: { browser: "chromium" },
    image: { width: 40, height: 30, url: expect.any(String) },
    baselineImage: { url: expect.any(String) },
    diffImage: null,
    lastReview: null,
    flaky: null,
  });
});

it("stores the browsers of a build from snapshot metadata on finalize", async () => {
  const { t, user, grant, buildId } = await setup();
  await grant("read");
  await t.run(async (ctx) => {
    await ctx.db
      .update(builds)
      .set({ status: "pending", browsers: [] })
      .where(eq(builds._id, buildId));
    await ctx.db.insert(snapshots).values(
      [{ browser: "webkit" }, { browser: "chromium" }, { browser: 1 }].map(
        (metadata, index) => ({
          buildId,
          shardIndex: 1,
          name: `Page ${index}`,
          diffStatus: "unchanged" as const,
          reviewState: "none" as const,
          metadata,
        }),
      ),
    );
  });
  await t.mutation(internal.builds.finalize, { buildId, cursor: null });

  expect(
    await user.query(api.builds.get, { ...repo, number: 2 }),
  ).toMatchObject({ browsers: ["chromium", "webkit"] });
  const unchanged = await user.query(api.snapshots.list, {
    buildId,
    diffStatus: "unchanged",
    paginationOpts: firstPage,
  });
  expect(unchanged.page.map((row) => row.browser)).toEqual([
    null,
    "webkit",
    "chromium",
    null,
  ]);
});

it("flags a snapshot that flips between images or differs on the same commit", async () => {
  const { t, user, grant, projectId } = await setup();
  await grant("read");
  const ids = await t.run(async (ctx) => {
    const project = first(
      await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
    );
    const earliest = first(
      await ctx.db.select().from(builds).orderBy(asc(builds.number)).limit(1),
    );
    if (project === null || earliest === null) {
      throw new Error("missing fixture");
    }
    const { _id, _creationTime, baselineBuildId, prNumber, ...base } = earliest;
    const image = async (hash: string) =>
      one(
        await ctx.db
          .insert(images)
          .values({
            accountId: project.accountId,
            hash,
            kind: "screenshot",
            bytes: 3,
            width: 40,
            height: 30,
            blobKey: `${project.accountId}/${hash}`,
            lastReferencedAt: 0,
          })
          .returning({ _id: images._id }),
      )._id;
    const a = await image("a");
    const b = await image("b");
    const insert = async (
      number: number,
      imageId: Id<"images">,
      fields: { branch?: string; commitSha?: string } = {},
    ) => {
      const { _id: buildId } = one(
        await ctx.db
          .insert(builds)
          .values({
            ...base,
            number,
            commitSha: `c${number}`,
            nonce: `n${number}`,
            ...fields,
          })
          .returning({ _id: builds._id }),
      );
      return one(
        await ctx.db
          .insert(snapshots)
          .values({
            buildId,
            shardIndex: 1,
            name: "Header",
            imageId,
            baselineImageId: imageId === a ? b : a,
            diffStatus: "changed",
            reviewState: "pending",
            metadata: {},
          })
          .returning({ _id: snapshots._id }),
      )._id;
    };
    await insert(3, a);
    await insert(4, b);
    await insert(5, a);
    const flipped = await insert(6, b, { branch: "feature" });
    const sameCommit = await insert(7, a, {
      branch: "feature",
      commitSha: "c6",
    });
    return { flipped, sameCommit };
  });
  const flaky = async (number: number, snapshotId: Id<"snapshots">) =>
    (await user.query(api.snapshots.get, { ...repo, number, snapshotId }))
      ?.flaky;

  expect(await flaky(6, ids.flipped)).toEqual({
    flips: 3,
    builds: 4,
    sameCommitBuild: 7,
  });
  expect(await flaky(7, ids.sameCommit)).toMatchObject({ sameCommitBuild: 6 });
});

it("links Blobs images through the site, private ones under the project", async () => {
  for (const isPrivate of [true, false]) {
    const { t, user, grant, projectId, snapshotId, imageId } = await setup({
      private: isPrivate,
    });
    await grant("read");
    const accountId = await t.run(async (ctx) => {
      const image = first(
        await ctx.db.select().from(images).where(eq(images._id, imageId)),
      );
      await ctx.db
        .update(images)
        .set({
          blobKey: `${image?.accountId}/0b9f4e1c-2d3a-4b5c-8d6e-7f8091a2b3c4`,
        })
        .where(eq(images._id, imageId));
      return image?.accountId;
    });
    const detail = await user.query(api.snapshots.get, {
      ...repo,
      number: 2,
      snapshotId,
    });
    const file = `${accountId}.0b9f4e1c-2d3a-4b5c-8d6e-7f8091a2b3c4`;
    const url = new URL(detail?.image?.url ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(
      isPrivate
        ? `https://stateofpixel.test/api/images/${projectId}/${file}`
        : `https://stateofpixel.test/api/images/${file}`,
    );
    const key = `${accountId}/0b9f4e1c-2d3a-4b5c-8d6e-7f8091a2b3c4`;
    const token = url.searchParams.get("t") ?? "";
    expect(
      await verify(
        SECRET,
        messages.image(isPrivate ? projectId : PUBLIC_IMAGE_SCOPE, key),
        token,
      ),
    ).toBe(true);
    expect(
      await verify(
        SECRET,
        messages.image(isPrivate ? PUBLIC_IMAGE_SCOPE : projectId, key),
        token,
      ),
    ).toBe(false);
  }
});

it("refuses an image link grant without read access", async () => {
  const { user, grant, projectId } = await setup();
  await grant("none");
  await expect(user.mutation(api.images.grant, { projectId })).rejects.toThrow(
    /not_found/,
  );
});

it("shows the account home only to members", async () => {
  const { t, user } = await setup();
  const home = await user.query(api.accounts.home, { login: "acme" });
  expect(home).toMatchObject({
    login: "acme",
    installationSettingsUrl:
      "https://github.com/organizations/acme/settings/installations/10",
  });
  const strangerId = await t.run((ctx) =>
    insertUser(ctx, {
      githubUserId: 7,
      login: "stranger",
      githubToken: "ghu_x",
    }),
  );
  expect(
    await t.withUser(strangerId).query(api.accounts.home, { login: "acme" }),
  ).toBeNull();
  expect(
    (
      await t.withUser(strangerId).query(api.accounts.projects, {
        login: "acme",
        paginationOpts: firstPage,
      })
    ).page,
  ).toEqual([]);
});

it("sorts and searches account projects", async () => {
  const { t, user, projectId } = await setup();
  await t.run(async (ctx) => {
    const project = first(
      await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
    );
    if (project === null) {
      return;
    }
    await ctx.db
      .update(projects)
      .set({ lastBuildAt: 10 })
      .where(eq(projects._id, projectId));
    const { _id, _creationTime, ...fields } = project;
    await ctx.db.insert(projects).values({
      ...fields,
      providerRepoId: 101,
      name: "docs-site",
      lastBuildAt: 5,
    });
    await ctx.db.insert(projects).values({
      ...fields,
      providerRepoId: 102,
      name: "archived-app",
      archivedAt: 1,
    });
  });
  const names = async (args: {
    search?: string;
    sort?: "name" | "updated";
    order?: "asc" | "desc";
  }) =>
    (
      await user.query(api.accounts.projects, {
        login: "acme",
        paginationOpts: firstPage,
        ...args,
      })
    ).page.map((project) => project.name);

  expect(await names({})).toEqual(["docs-site", "web-app"]);
  expect(await names({ order: "desc" })).toEqual(["web-app", "docs-site"]);
  expect(await names({ sort: "updated" })).toEqual(["web-app", "docs-site"]);
  expect(await names({ sort: "updated", order: "asc" })).toEqual([
    "docs-site",
    "web-app",
  ]);
  expect(await names({ search: "docs" })).toEqual(["docs-site"]);
  const [webApp] = (
    await user.query(api.accounts.projects, {
      login: "acme",
      search: "web",
      paginationOpts: firstPage,
    })
  ).page;
  expect(webApp).toMatchObject({
    name: "web-app",
    latestBuild: { number: 2, branch: "feature", conclusion: "changes" },
  });
});

it("filters builds by state and pull request, in either order", async () => {
  const { user, grant } = await setup();
  await grant("read");
  const numbers = async (args: {
    states?: ("to_review" | "approved" | "pending")[];
    prNumber?: number;
    branch?: string;
    order?: "asc" | "desc";
  }) =>
    (
      await user.query(api.builds.list, {
        ...repo,
        paginationOpts: firstPage,
        ...args,
      })
    ).page.map((build) => build.number);

  expect(await numbers({})).toEqual([2, 1]);
  expect(await numbers({ order: "asc" })).toEqual([1, 2]);
  expect(await numbers({ states: ["to_review"] })).toEqual([2]);
  expect(await numbers({ states: ["approved"] })).toEqual([1]);
  expect(await numbers({ states: ["pending"] })).toEqual([]);
  expect(await numbers({ states: ["to_review", "approved"] })).toEqual([2, 1]);
  expect(await numbers({ states: ["pending", "approved"] })).toEqual([1]);
  expect(await numbers({ prNumber: 7 })).toEqual([2]);
  expect(await numbers({ prNumber: 7, states: ["approved"] })).toEqual([]);
  expect(await numbers({ branch: "main", states: ["approved"] })).toEqual([1]);
});

async function buildState(t: TestBackend, buildId: Id<"builds">) {
  return t.run(async (ctx) => {
    const build = first(
      await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
    );
    return {
      conclusion: build?.conclusion,
      counts: build?.counts,
      checkVersion: build?.checkVersion,
    };
  });
}

it("approves, rejects and undoes a snapshot and updates the build", async () => {
  const { t, user, grant, buildId, snapshotId } = await setup();
  await grant("write");

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: [snapshotId],
    action: "approve",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "approved",
    counts: { pending: 0, approved: 1 },
    checkVersion: 2,
  });
  expect(
    await t.run((ctx) => ctx.db.select().from(approvedImages)),
  ).toHaveLength(1);

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: [snapshotId],
    action: "reject",
    comment: " Header moved ",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "rejected",
    counts: { approved: 0, rejected: 1 },
  });
  expect(
    await t.run((ctx) => ctx.db.select().from(approvedImages)),
  ).toHaveLength(0);
  const detail = await user.query(api.snapshots.get, {
    ...repo,
    number: 2,
    snapshotId,
  });
  expect(detail?.lastReview).toMatchObject({
    action: "reject",
    login: "octocat",
    comment: "Header moved",
  });

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: [snapshotId],
    action: "undo",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "changes",
    counts: { pending: 1, rejected: 0 },
  });
});

it("needs write access and a reviewable build", async () => {
  const { user, grant, buildId, snapshotId } = await setup();
  await grant("read");
  await expect(
    user.mutation(api.reviews.apply, {
      buildId,
      snapshotIds: [snapshotId],
      action: "approve",
    }),
  ).rejects.toThrow(/forbidden/);

  const {
    t: t2,
    user: writer,
    grant: grantWrite,
    buildId: supersededId,
    snapshotId: s2,
  } = await setup();
  await grantWrite("write");
  await t2.run((ctx) =>
    ctx.db
      .update(builds)
      .set({ supersededById: supersededId })
      .where(eq(builds._id, supersededId)),
  );
  await expect(
    writer.mutation(api.reviews.apply, {
      buildId: supersededId,
      snapshotIds: [s2],
      action: "approve",
    }),
  ).rejects.toThrow(/build_not_reviewable/);
});

it("approves every pending snapshot with approve all", async () => {
  const { t, user, grant, buildId } = await setup();
  await grant("write");
  await t.run(async (ctx) => {
    for (const name of ["A", "B", "C"]) {
      await ctx.db.insert(snapshots).values({
        buildId,
        shardIndex: 1,
        name,
        diffStatus: "added",
        reviewState: "pending",
        metadata: {},
      });
    }
    const build = first(
      await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
    );
    if (build) {
      await ctx.db
        .update(builds)
        .set({ counts: { ...build.counts, added: 3, pending: 4 } })
        .where(eq(builds._id, buildId));
    }
  });

  vi.useFakeTimers();
  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "approve",
  });
  await t.runAllJobs();
  vi.useRealTimers();

  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "approved",
    counts: { pending: 0, approved: 4 },
  });
  const sources = await t.run(async (ctx) =>
    (
      await ctx.db
        .select()
        .from(reviews)
        .orderBy(asc(reviews._creationTime), asc(reviews._id))
    ).map((review) => review.source),
  );
  expect(sources).toEqual([
    "approve_all",
    "approve_all",
    "approve_all",
    "approve_all",
  ]);
});

it("undoes a build action, then every review once no build action is left", async () => {
  const { t, user, grant, buildId, snapshotId } = await setup();
  await grant("write");
  await t.run(async (ctx) => {
    for (const name of ["A", "B", "C"]) {
      await ctx.db.insert(snapshots).values({
        buildId,
        shardIndex: 1,
        name,
        diffStatus: "added",
        reviewState: "pending",
        metadata: {},
      });
    }
    const build = first(
      await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
    );
    if (build) {
      await ctx.db
        .update(builds)
        .set({ counts: { ...build.counts, added: 3, pending: 4 } })
        .where(eq(builds._id, buildId));
    }
  });
  const buildAction = () =>
    t.run(
      async (ctx) =>
        first(await ctx.db.select().from(builds).where(eq(builds._id, buildId)))
          ?.buildAction,
    );

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: [snapshotId],
    action: "approve",
  });
  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "reject",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    counts: { pending: 0, approved: 1, rejected: 3 },
  });
  expect(await buildAction()).toBe("reject");

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "approve",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "approved",
    counts: { pending: 0, approved: 4, rejected: 0 },
  });
  expect(await buildAction()).toBe("approve");

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "undo",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "changes",
    counts: { pending: 3, approved: 1, rejected: 0 },
  });
  expect(await buildAction()).toBeNull();

  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "undo",
  });
  expect(await buildState(t, buildId)).toMatchObject({
    counts: { pending: 4, approved: 0, rejected: 0 },
  });
});

it("saves settings for admins only and checks the values", async () => {
  const writer = await setup();
  await writer.grant("write");
  expect(
    await writer.user.query(api.projects.settings, {
      projectId: writer.projectId,
    }),
  ).toBeNull();

  const { user, grant, projectId } = await setup();
  await grant("admin");
  await user.mutation(api.projects.updateSettings, {
    projectId,
    autoApproveBranches: [" main ", "release/*", ""],
    diffThreshold: 0.2,
  });
  expect(await user.query(api.projects.settings, { projectId })).toEqual({
    defaultBranch: "main",
    autoApproveBranches: ["main", "release/*"],
    diffThreshold: 0.2,
    diffIncludeAA: false,
    prRetentionDays: 30,
  });
  await expect(
    user.mutation(api.projects.updateSettings, {
      projectId,
      prRetentionDays: 3,
    }),
  ).rejects.toThrow(/invalid_retention/);
  await expect(
    user.mutation(api.projects.updateSettings, {
      projectId,
      diffThreshold: 2,
    }),
  ).rejects.toThrow(/invalid_threshold/);
});

it("deletes a project and its builds after the name is confirmed", async () => {
  const { t, user, grant, projectId } = await setup();
  await grant("admin");
  await expect(
    user.mutation(api.projects.remove, { projectId, confirmName: "web" }),
  ).rejects.toThrow(/confirm_name_mismatch/);

  vi.useFakeTimers();
  await user.mutation(api.projects.remove, {
    projectId,
    confirmName: "web-app",
  });
  await t.runAllJobs();
  vi.useRealTimers();

  const left = await t.run(async (ctx) => ({
    projects: one(await ctx.db.select({ count: count() }).from(projects)).count,
    builds: one(await ctx.db.select({ count: count() }).from(builds)).count,
    snapshots: one(await ctx.db.select({ count: count() }).from(snapshots))
      .count,
  }));
  expect(left).toEqual({ projects: 0, builds: 0, snapshots: 0 });
});

it("lists the current baselines and the history of one snapshot", async () => {
  const { t, user, grant } = await setup();
  await grant("read");
  await t.run(async (ctx) => {
    const baseline = first(
      await ctx.db.select().from(builds).orderBy(asc(builds.number)).limit(1),
    );
    const image = first(await ctx.db.select().from(images).limit(1));
    if (baseline === null || image === null) {
      throw new Error("setup missing");
    }
    for (const [name, diffStatus] of [
      ["components/Button", "added"],
      ["components/Card", "added"],
      ["pages/Home", "added"],
      ["pages/Old", "removed"],
    ] as const) {
      await ctx.db.insert(snapshots).values({
        buildId: baseline._id,
        shardIndex: 1,
        name,
        imageId: diffStatus === "removed" ? null : image._id,
        diffStatus,
        reviewState: diffStatus === "removed" ? "none" : "approved",
        metadata: {},
      });
    }
  });

  const all = await user.query(api.baselines.list, {
    ...repo,
    buildName: "default",
    paginationOpts: firstPage,
  });
  expect(await user.query(api.baselines.current, repo)).toEqual([
    { buildName: "default", build: { number: 1, commitSha: "c1" } },
  ]);
  expect(all.page.map((snapshot) => snapshot.name)).toEqual([
    "components/Button",
    "components/Card",
    "pages/Home",
  ]);
  const components = await user.query(api.baselines.list, {
    ...repo,
    buildName: "default",
    prefix: "components/",
    paginationOpts: firstPage,
  });
  expect(components.page).toHaveLength(2);

  const history = await user.query(api.baselines.history, {
    ...repo,
    snapshotName: "pages/Home",
  });
  expect(history).toMatchObject({
    buildName: "default",
    entries: [{ buildNumber: 1, commitSha: "c1", diffStatus: "added" }],
  });
  expect(history?.entries[0]?.image?.url).toEqual(expect.any(String));
});

it("says when retention deleted a build", async () => {
  const { t, user, grant, projectId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db
      .update(projects)
      .set({ nextBuildNumber: 5 })
      .where(eq(projects._id, projectId));
    await ctx.db.insert(deletedBuilds).values({
      projectId,
      number: 3,
      branch: "old-feature",
      prNumber: 9,
      reason: "pr_closed",
      retentionDays: 30,
    });
  });
  const deleted = (number: number) =>
    user.query(api.builds.deleted, { ...repo, number });

  expect(await deleted(3)).toBeNull();

  await grant("read");
  expect(await deleted(3)).toMatchObject({
    deletion: {
      branch: "old-feature",
      prNumber: 9,
      reason: "pr_closed",
      retentionDays: 30,
    },
  });
  expect(await deleted(4)).toEqual({ deletion: null });
  expect(await deleted(2)).toBeNull();
  expect(await deleted(5)).toBeNull();
  expect(await deleted(0)).toBeNull();
});

it("returns the account's billing state and role to writers", async () => {
  const { t, user, grant, userId } = await setup();
  await grant("write");
  await t.run(async (ctx) => {
    const project = first(
      await ctx.db
        .select()
        .from(projects)
        .where(and(eq(projects.owner, "acme"), eq(projects.name, "web-app"))),
    );
    if (project === null) {
      throw new Error("No project");
    }
    await ctx.db
      .update(accounts)
      .set({
        plan: "25gb",
        billingSubscriptionId: "sub_1",
        billingStatus: "on_hold",
        billingPeriodEndsAt: 1000,
      })
      .where(eq(accounts._id, project.accountId));
    const membership = first(
      await ctx.db
        .select()
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.accountId, project.accountId),
            eq(accountMembers.userId, userId),
          ),
        ),
    );
    if (membership !== null) {
      await ctx.db
        .update(accountMembers)
        .set({ role: "member" })
        .where(eq(accountMembers._id, membership._id));
    }
  });

  expect((await user.query(api.projects.access, repo))?.account).toEqual({
    type: "org",
    role: "member",
    storage: {
      plan: "25gb",
      storageBytes: 0,
      storageLimitBytes: 10 * 1024 ** 3,
    },
    subscription: {
      id: "sub_1",
      status: "on_hold",
      interval: null,
      periodEndsAt: 1000,
      cancelsAtPeriodEnd: false,
    },
  });
});

it("hides the account's billing state from readers", async () => {
  const { user, grant } = await setup();
  await grant("read");
  expect((await user.query(api.projects.access, repo))?.account).toBeNull();
});
