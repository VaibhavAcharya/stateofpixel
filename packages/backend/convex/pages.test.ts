/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
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
    checkedAt = Date.now(),
  ) =>
    t.run((ctx) =>
      ctx.db.insert("repoPermissions", {
        userId: ids.userId,
        projectId: ids.projectId,
        permission,
        orgOwner: false,
        checkedAt,
      }),
    );
  return { t, user, grant, ...ids };
}

const firstPage = { numItems: 50, cursor: null };

it("asks for a permission check before showing a private project", async () => {
  const { user, grant, projectId } = await setup();
  expect(
    await user.query(api.projects.access, { owner: "acme", name: "web-app" }),
  ).toMatchObject({
    projectId,
    fresh: false,
    canRead: false,
  });
  await expect(
    user.query(api.builds.list, { projectId, paginationOpts: firstPage }),
  ).rejects.toThrow(/permission_unknown/);

  await grant("write");
  expect(
    await user.query(api.projects.access, { owner: "acme", name: "web-app" }),
  ).toMatchObject({
    fresh: true,
    canRead: true,
    canWrite: true,
  });
});

it("treats a stale permission as unknown and none as not found", async () => {
  const { user, grant, projectId } = await setup();
  await grant("read", Date.now() - 10 * 60 * 1000);
  await expect(
    user.query(api.builds.list, { projectId, paginationOpts: firstPage }),
  ).rejects.toThrow(/permission_unknown/);

  const {
    user: other,
    grant: grantNone,
    projectId: otherProject,
  } = await setup();
  await grantNone("none");
  await expect(
    other.query(api.builds.list, {
      projectId: otherProject,
      paginationOpts: firstPage,
    }),
  ).rejects.toThrow(/not_found/);
});

it("lets anyone read a public project", async () => {
  const { t, projectId } = await setup({ private: false });
  const page = await t.query(api.builds.list, {
    projectId,
    paginationOpts: firstPage,
  });
  expect(page.page.map((build) => build.number)).toEqual([2, 1]);
});

it("lists builds by branch and returns build and snapshot details", async () => {
  const { user, grant, projectId, buildId, snapshotId } = await setup();
  await grant("read");

  const feature = await user.query(api.builds.list, {
    projectId,
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
    await user.query(api.builds.get, { projectId, number: 2 }),
  ).toMatchObject({
    buildId,
    baseline: { number: 1, branch: "main" },
    supersededBy: null,
  });
  expect(await user.query(api.builds.get, { projectId, number: 9 })).toBeNull();

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

  const detail = await user.query(api.snapshots.get, { buildId, snapshotId });
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
    projects: [
      {
        name: "web-app",
        latestBuild: { number: 2, branch: "feature", conclusion: "changes" },
      },
    ],
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
});
