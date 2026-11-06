import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  findMembership,
  memberRole,
  toStorageUsage,
  toSubscription,
} from "./accounts.ts";
import { internal } from "./api.ts";
import { first } from "./db/index.ts";
import {
  MAX_DIFF_MAX_PIXELS,
  MAX_RETENTION_DAYS,
  MAX_SNAPSHOT_NAME_LENGTH,
  MIN_RETENTION_DAYS,
} from "./lib/limits.ts";
import {
  allows,
  findAllowedProject,
  findProject,
  readAccess,
  requirePermission,
} from "./lib/permissions.ts";
import { deleteBuildRows } from "./retention.ts";
import {
  accountMembers,
  accounts,
  approvedImages,
  builds,
  connections,
  deletedBuilds,
  projects,
  projectTokens,
  users,
} from "./schema.ts";
import {
  AppError,
  internalMutation,
  mutation,
  paginate,
  query,
} from "./server.ts";

const MAX_BRANCH_PATTERNS = 20;
const MAX_BRANCH_PATTERN_LENGTH = 200;
const MAX_UNSTABLE_SNAPSHOTS = 100;
const DELETE_PAGE_SIZE = 500;

export const access = query({
  args: { owner: z.string(), name: z.string() },
  handler: async (ctx, { owner, name }) => {
    const project = await findProject(ctx, owner, name);
    if (project === null) {
      return null;
    }
    const access = await readAccess(ctx, project._id);
    const canWrite = allows(project, access, "write");
    const account = canWrite
      ? first(
          await ctx.db
            .select()
            .from(accounts)
            .where(eq(accounts._id, project.accountId)),
        )
      : null;
    const { userId } = access;
    const user =
      account === null || userId === null
        ? null
        : first(
            await ctx.db
              .select({ _id: users._id, login: connections.login })
              .from(users)
              .leftJoin(
                connections,
                and(
                  eq(connections.userId, users._id),
                  eq(connections.provider, "github"),
                ),
              )
              .where(eq(users._id, userId)),
          );
    const membership =
      account === null || userId === null
        ? null
        : first(
            await ctx.db
              .select()
              .from(accountMembers)
              .where(
                and(
                  eq(accountMembers.accountId, account._id),
                  eq(accountMembers.userId, userId),
                ),
              ),
          );
    return {
      projectId: project._id,
      owner: project.owner,
      name: project.name,
      private: project.private,
      defaultBranch: project.defaultBranch,
      permission: access.permission,
      fresh: access.fresh,
      canRead: allows(project, access, "read"),
      canWrite,
      canAdmin: allows(project, access, "admin"),
      hasBuilds: project.lastBuildAt !== null,
      account:
        account === null
          ? null
          : {
              type: account.type,
              role:
                user === null || membership === null
                  ? null
                  : memberRole(account, user, membership),
              storage: toStorageUsage(account),
              subscription: toSubscription(account),
            },
    };
  },
});

export const settings = query({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    const project = await findAllowedProject(ctx, projectId, "write");
    if (project === null) {
      return null;
    }
    return {
      defaultBranch: project.defaultBranch,
      autoApproveBranches: project.autoApproveBranches,
      diffThreshold: project.diffThreshold,
      diffIncludeAA: project.diffIncludeAA,
      diffMaxPixels: project.diffMaxPixels,
      unstableSnapshots: project.unstableSnapshots,
      prRetentionDays: project.prRetentionDays,
    };
  },
});

export const updateSettings = mutation({
  args: {
    projectId: z.string(),
    autoApproveBranches: z.array(z.string()).optional(),
    diffThreshold: z.number().optional(),
    diffIncludeAA: z.boolean().optional(),
    diffMaxPixels: z.number().optional(),
    unstableSnapshots: z.array(z.string()).optional(),
    prRetentionDays: z.number().optional(),
  },
  handler: async (ctx, { projectId, ...changes }) => {
    const needsAdmin =
      changes.autoApproveBranches !== undefined ||
      changes.prRetentionDays !== undefined;
    await requirePermission(ctx, projectId, needsAdmin ? "admin" : "write");
    const autoApproveBranches = changes.autoApproveBranches
      ?.map((pattern) => pattern.trim())
      .filter((pattern) => pattern !== "");
    if (
      autoApproveBranches !== undefined &&
      (autoApproveBranches.length > MAX_BRANCH_PATTERNS ||
        autoApproveBranches.some(
          (pattern) => pattern.length > MAX_BRANCH_PATTERN_LENGTH,
        ))
    ) {
      throw new AppError({ code: "invalid_branches" });
    }
    const unstableSnapshots =
      changes.unstableSnapshots === undefined
        ? undefined
        : [
            ...new Set(
              changes.unstableSnapshots
                .map((pattern) => pattern.trim())
                .filter((pattern) => pattern !== ""),
            ),
          ];
    if (
      unstableSnapshots !== undefined &&
      !isValidUnstableList(unstableSnapshots)
    ) {
      throw new AppError({ code: "invalid_unstable_snapshots" });
    }
    const { diffThreshold, diffMaxPixels, prRetentionDays } = changes;
    if (
      diffThreshold !== undefined &&
      !(diffThreshold >= 0 && diffThreshold <= 1)
    ) {
      throw new AppError({ code: "invalid_threshold" });
    }
    if (
      diffMaxPixels !== undefined &&
      !(
        Number.isInteger(diffMaxPixels) &&
        diffMaxPixels >= 0 &&
        diffMaxPixels <= MAX_DIFF_MAX_PIXELS
      )
    ) {
      throw new AppError({ code: "invalid_max_pixels" });
    }
    if (
      prRetentionDays !== undefined &&
      !(
        Number.isInteger(prRetentionDays) &&
        prRetentionDays >= MIN_RETENTION_DAYS &&
        prRetentionDays <= MAX_RETENTION_DAYS
      )
    ) {
      throw new AppError({ code: "invalid_retention" });
    }
    const fields = {
      ...changes,
      ...(autoApproveBranches === undefined ? {} : { autoApproveBranches }),
      ...(unstableSnapshots === undefined ? {} : { unstableSnapshots }),
    };
    if (Object.keys(fields).length > 0) {
      await ctx.db
        .update(projects)
        .set(fields)
        .where(eq(projects._id, projectId));
    }
    if (unstableSnapshots !== undefined) {
      await ctx.scheduler.runAfter(0, internal.reviews.approveUnstable, {
        projectId,
        afterBuildId: null,
      });
    }
    return null;
  },
});

export const markUnstable = mutation({
  args: { buildId: z.string(), name: z.string() },
  handler: async (ctx, { buildId, name }) => {
    const build = first(
      await ctx.db.select().from(builds).where(eq(builds._id, buildId)),
    );
    if (build === null) {
      throw new AppError({ code: "not_found" });
    }
    const { project } = await requirePermission(ctx, build.projectId, "write");
    const pattern = name.trim();
    if (project.unstableSnapshots.includes(pattern)) {
      return null;
    }
    const unstableSnapshots = [...project.unstableSnapshots, pattern];
    if (pattern === "" || !isValidUnstableList(unstableSnapshots)) {
      throw new AppError({ code: "invalid_unstable_snapshots" });
    }
    await ctx.db
      .update(projects)
      .set({ unstableSnapshots })
      .where(eq(projects._id, project._id));
    await ctx.scheduler.runAfter(0, internal.reviews.approveUnstable, {
      projectId: project._id,
      afterBuildId: null,
    });
    return null;
  },
});

function isValidUnstableList(patterns: string[]): boolean {
  return (
    patterns.length <= MAX_UNSTABLE_SNAPSHOTS &&
    patterns.every((pattern) => pattern.length <= MAX_SNAPSHOT_NAME_LENGTH)
  );
}

export const remove = mutation({
  args: { projectId: z.string(), confirmName: z.string() },
  handler: async (ctx, { projectId, confirmName }) => {
    const { project } = await requirePermission(ctx, projectId, "admin");
    if (confirmName !== project.name) {
      throw new AppError({ code: "confirm_name_mismatch" });
    }
    await ctx.db.delete(projects).where(eq(projects._id, projectId));
    await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
      projectId,
    });
    return null;
  },
});

export const removeArchived = mutation({
  args: { login: z.string(), projectId: z.string(), confirmName: z.string() },
  handler: async (ctx, { login, projectId, confirmName }) => {
    const found = await findMembership(ctx, login);
    const project = first(
      await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
    );
    if (
      found === null ||
      memberRole(found.account, found.user, found.membership) !== "owner" ||
      project === null ||
      project.accountId !== found.account._id ||
      project.archivedAt === null
    ) {
      throw new AppError({ code: "not_found" });
    }
    if (confirmName !== project.name) {
      throw new AppError({ code: "confirm_name_mismatch" });
    }
    await ctx.db.delete(projects).where(eq(projects._id, projectId));
    await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
      projectId,
    });
    return null;
  },
});

export const deleteData = internalMutation({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    const build = first(
      await ctx.db
        .select()
        .from(builds)
        .where(eq(builds.projectId, projectId))
        .orderBy(asc(builds.number), asc(builds._creationTime))
        .limit(1),
    );
    if (build !== null) {
      if (await deleteBuildRows(ctx, build._id)) {
        if (build.expiryJobId !== null && build.status === "pending") {
          await ctx.scheduler.cancel(build.expiryJobId);
        }
        await ctx.db.delete(builds).where(eq(builds._id, build._id));
      }
      await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
        projectId,
      });
      return null;
    }
    const approvals = await ctx.db
      .select({ _id: approvedImages._id })
      .from(approvedImages)
      .where(eq(approvedImages.projectId, projectId))
      .limit(DELETE_PAGE_SIZE);
    const tokens = await ctx.db
      .select({ _id: projectTokens._id })
      .from(projectTokens)
      .where(eq(projectTokens.projectId, projectId))
      .limit(DELETE_PAGE_SIZE);
    const deleted = await ctx.db
      .select({ _id: deletedBuilds._id })
      .from(deletedBuilds)
      .where(eq(deletedBuilds.projectId, projectId))
      .limit(DELETE_PAGE_SIZE);
    for (const approval of approvals) {
      await ctx.db
        .delete(approvedImages)
        .where(eq(approvedImages._id, approval._id));
    }
    for (const token of tokens) {
      await ctx.db
        .delete(projectTokens)
        .where(eq(projectTokens._id, token._id));
    }
    for (const deletedBuild of deleted) {
      await ctx.db
        .delete(deletedBuilds)
        .where(eq(deletedBuilds._id, deletedBuild._id));
    }
    if (
      approvals.length === DELETE_PAGE_SIZE ||
      tokens.length === DELETE_PAGE_SIZE ||
      deleted.length === DELETE_PAGE_SIZE
    ) {
      await ctx.scheduler.runAfter(0, internal.projects.deleteData, {
        projectId,
      });
    }
    return null;
  },
});

const BACKFILL_PAGE_SIZE = 100;

export const backfillLastBuildAt = internalMutation({
  args: { cursor: z.string().nullable() },
  handler: async (ctx, { cursor }) => {
    const page = await paginate(
      { numItems: BACKFILL_PAGE_SIZE, cursor },
      (limit, offset) =>
        ctx.db
          .select()
          .from(projects)
          .orderBy(asc(projects._creationTime), asc(projects._id))
          .limit(limit)
          .offset(offset),
    );
    for (const project of page.page) {
      const build = first(
        await ctx.db
          .select()
          .from(builds)
          .where(eq(builds.projectId, project._id))
          .orderBy(desc(builds.number), desc(builds._creationTime))
          .limit(1),
      );
      if (build !== null && project.lastBuildAt === null) {
        await ctx.db
          .update(projects)
          .set({ lastBuildAt: build._creationTime })
          .where(eq(projects._id, project._id));
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.projects.backfillLastBuildAt, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
