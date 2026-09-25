/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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

async function setup({ private: isPrivate = true } = {}) {
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
      storageLimitBytes: 0,
      storageBytes: 0,
    });
    await ctx.db.insert("accountMembers", { accountId, userId });
    const projectId = await ctx.db.insert("projects", {
      accountId,
      githubRepoId: 100,
      owner: "acme",
      name: "web-app",
      private: isPrivate,
      defaultBranch: "main",
      autoApproveBranches: ["main"],
      diffThreshold: 0.1,
      diffIncludeAA: false,
      prRetentionDays: 30,
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
    const baselineId = await ctx.db.insert("builds", {
      ...base,
      number: 1,
      commitSha: "c1",
      branch: "main",
      nonce: "n1",
      status: "finalized",
      conclusion: "approved",
    });
    const buildId = await ctx.db.insert("builds", {
      ...base,
      number: 2,
      commitSha: "c2",
      branch: "feature",
      prNumber: 7,
      nonce: "n2",
      status: "finalized",
      conclusion: "changes",
      baselineBuildId: baselineId,
    });
    const storageId = await ctx.storage.store(new Blob(["png"]));
    const imageId = await ctx.db.insert("images", {
      accountId,
      hash: "h",
      kind: "screenshot",
      bytes: 3,
      width: 40,
      height: 30,
      store: "convex",
      storageId,
      lastReferencedAt: 0,
    });
    const snapshotId = await ctx.db.insert("snapshots", {
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
    });
    await ctx.db.insert("snapshots", {
      buildId,
      shardIndex: 1,
      name: "Footer",
      imageId,
      diffStatus: "unchanged",
      reviewState: "none",
      metadata: {},
    });
    return { userId, projectId, buildId, snapshotId };
  });
  const user = t.withIdentity({ subject: `${ids.userId}|session` });
  const grant = (
    permission: "none" | "read" | "write" | "admin",
    freshness: "fresh" | "stale" | "expired" = "fresh",
  ) =>
    t.run((ctx) =>
      ctx.db.insert("repoPermissions", {
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
  await t.finishInProgressScheduledFunctions();
  expect(await access()).toMatchObject({ fresh: false, canRead: true });

  vi.advanceTimersByTime(10 * 60 * 1000);
  await t.finishInProgressScheduledFunctions();
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
  });
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
    ctx.db.insert("users", {
      githubUserId: 7,
      login: "stranger",
      githubToken: "ghu_x",
      lastSeenAt: 0,
    }),
  );
  expect(
    await t
      .withIdentity({ subject: `${strangerId}|s` })
      .query(api.accounts.home, { login: "acme" }),
  ).toBeNull();
  expect(
    (
      await t
        .withIdentity({ subject: `${strangerId}|s` })
        .query(api.accounts.projects, {
          login: "acme",
          paginationOpts: firstPage,
        })
    ).page,
  ).toEqual([]);
});

it("sorts and searches account projects", async () => {
  const { t, user, projectId } = await setup();
  await t.run(async (ctx) => {
    const project = await ctx.db.get("projects", projectId);
    if (project === null) {
      return;
    }
    await ctx.db.patch("projects", projectId, { lastBuildAt: 10 });
    const { _id, _creationTime, ...fields } = project;
    await ctx.db.insert("projects", {
      ...fields,
      githubRepoId: 101,
      name: "docs-site",
      lastBuildAt: 5,
    });
    await ctx.db.insert("projects", {
      ...fields,
      githubRepoId: 102,
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

async function buildState(
  t: ReturnType<typeof convexTest>,
  buildId: Id<"builds">,
) {
  return t.run(async (ctx) => {
    const build = await ctx.db.get("builds", buildId);
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
    await t.run((ctx) => ctx.db.query("approvedImages").collect()),
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
    await t.run((ctx) => ctx.db.query("approvedImages").collect()),
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
    ctx.db.patch("builds", supersededId, { supersededById: supersededId }),
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
      await ctx.db.insert("snapshots", {
        buildId,
        shardIndex: 1,
        name,
        diffStatus: "added",
        reviewState: "pending",
        metadata: {},
      });
    }
    const build = await ctx.db.get("builds", buildId);
    if (build) {
      await ctx.db.patch("builds", buildId, {
        counts: { ...build.counts, added: 3, pending: 4 },
      });
    }
  });

  vi.useFakeTimers();
  await user.mutation(api.reviews.apply, {
    buildId,
    snapshotIds: "all",
    action: "approve",
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  expect(await buildState(t, buildId)).toMatchObject({
    conclusion: "approved",
    counts: { pending: 0, approved: 4 },
  });
  const sources = await t.run(async (ctx) =>
    (await ctx.db.query("reviews").collect()).map((review) => review.source),
  );
  expect(sources).toEqual([
    "approve_all",
    "approve_all",
    "approve_all",
    "approve_all",
  ]);
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
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  const left = await t.run(async (ctx) => ({
    projects: (await ctx.db.query("projects").collect()).length,
    builds: (await ctx.db.query("builds").collect()).length,
    snapshots: (await ctx.db.query("snapshots").collect()).length,
  }));
  expect(left).toEqual({ projects: 0, builds: 0, snapshots: 0 });
});

it("lists the current baselines and the history of one snapshot", async () => {
  const { t, user, grant } = await setup();
  await grant("read");
  await t.run(async (ctx) => {
    const baseline = await ctx.db
      .query("builds")
      .withIndex("by_projectId_and_number", (q) => q)
      .first();
    const image = await ctx.db.query("images").first();
    if (baseline === null || image === null) {
      throw new Error("setup missing");
    }
    for (const [name, diffStatus] of [
      ["components/Button", "added"],
      ["components/Card", "added"],
      ["pages/Home", "added"],
      ["pages/Old", "removed"],
    ] as const) {
      await ctx.db.insert("snapshots", {
        buildId: baseline._id,
        shardIndex: 1,
        name,
        imageId: diffStatus === "removed" ? undefined : image._id,
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
  expect(await user.query(api.baselines.current, repo)).toEqual({
    buildNames: ["default"],
    buildName: "default",
    build: { number: 1, commitSha: "c1" },
  });
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
