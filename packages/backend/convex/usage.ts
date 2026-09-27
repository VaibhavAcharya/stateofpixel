import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, query } from "./_generated/server";
import { findMembership, memberRole, toStorageUsage } from "./accounts";
import { isKeptBranch } from "./lib/matchesBranch";
import { storageUsage } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;
const SNAPSHOTS_PER_IMAGE = 50;
const MAX_DAILY_BUILDS = 1000;
const MAX_PROJECTS = 1000;
const MAX_USAGE_ROWS = 10_000;

const projectTotals = v.object({
  projectId: v.id("projects"),
  baselineBytes: v.number(),
  prBytes: v.number(),
  diffBytes: v.number(),
  uploadedImages: v.number(),
});

type ProjectTotals = Infer<typeof projectTotals>;

export const count = internalMutation({
  args: {
    accountId: v.optional(v.id("accounts")),
    cursor: v.optional(v.union(v.string(), v.null())),
    totals: v.optional(v.array(projectTotals)),
    startedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const account =
      args.accountId === undefined
        ? await ctx.db.query("accounts").order("asc").first()
        : await ctx.db.get("accounts", args.accountId);
    if (account === null) {
      return null;
    }
    const totals = new Map(
      (args.totals ?? []).map((row) => [row.projectId, row]),
    );
    const page = await ctx.db
      .query("images")
      .withIndex("by_accountId_and_hash", (q) => q.eq("accountId", account._id))
      .paginate({ numItems: PAGE_SIZE, cursor: args.cursor ?? null });
    const builds = new Map<Id<"builds">, Doc<"builds"> | null>();
    const projects = new Map<Id<"projects">, Doc<"projects"> | null>();
    for (const image of page.page) {
      const { projectId, baseline } =
        image.projectId === undefined
          ? await tagFromSnapshots(ctx, image, builds, projects)
          : { projectId: image.projectId, baseline: image.baseline === true };
      if (projectId === undefined) {
        continue;
      }
      const row = totals.get(projectId) ?? emptyTotals(projectId);
      if (image.kind === "diff") {
        row.diffBytes += image.bytes;
      } else if (baseline) {
        row.baselineBytes += image.bytes;
      } else {
        row.prBytes += image.bytes;
      }
      if (image._creationTime >= startedAt - DAY_MS) {
        row.uploadedImages++;
      }
      totals.set(projectId, row);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.usage.count, {
        accountId: account._id,
        cursor: page.continueCursor,
        totals: [...totals.values()],
        startedAt,
      });
      return null;
    }
    await writeUsage(ctx, account._id, totals, startedAt);
    const next = await ctx.db
      .query("accounts")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", account._creationTime),
      )
      .first();
    if (next !== null) {
      await ctx.scheduler.runAfter(0, internal.usage.count, {
        accountId: next._id,
        startedAt,
      });
    }
    return null;
  },
});

function emptyTotals(projectId: Id<"projects">): ProjectTotals {
  return {
    projectId,
    baselineBytes: 0,
    prBytes: 0,
    diffBytes: 0,
    uploadedImages: 0,
  };
}

async function tagFromSnapshots(
  ctx: MutationCtx,
  image: Doc<"images">,
  builds: Map<Id<"builds">, Doc<"builds"> | null>,
  projects: Map<Id<"projects">, Doc<"projects"> | null>,
): Promise<{ projectId: Id<"projects"> | undefined; baseline: boolean }> {
  const snapshots =
    image.kind === "diff"
      ? await ctx.db
          .query("snapshots")
          .withIndex("by_diffImageId", (q) => q.eq("diffImageId", image._id))
          .take(SNAPSHOTS_PER_IMAGE)
      : await ctx.db
          .query("snapshots")
          .withIndex("by_imageId", (q) => q.eq("imageId", image._id))
          .take(SNAPSHOTS_PER_IMAGE);
  let projectId: Id<"projects"> | undefined;
  let baseline = image.baseline === true;
  for (const snapshot of snapshots) {
    if (!builds.has(snapshot.buildId)) {
      builds.set(
        snapshot.buildId,
        await ctx.db.get("builds", snapshot.buildId),
      );
    }
    const build = builds.get(snapshot.buildId) ?? null;
    if (build === null) {
      continue;
    }
    if (!projects.has(build.projectId)) {
      projects.set(
        build.projectId,
        await ctx.db.get("projects", build.projectId),
      );
    }
    const project = projects.get(build.projectId) ?? null;
    projectId ??= build.projectId;
    baseline ||= project !== null && isKeptBranch(project, build.branch);
  }
  if (projectId !== undefined) {
    await ctx.db.patch("images", image._id, { projectId, baseline });
  }
  return { projectId, baseline };
}

async function writeUsage(
  ctx: MutationCtx,
  accountId: Id<"accounts">,
  totals: Map<Id<"projects">, ProjectTotals>,
  startedAt: number,
) {
  const day = toDay(startedAt);
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_accountId", (q) => q.eq("accountId", accountId))
    .take(MAX_PROJECTS);
  for (const project of projects) {
    const row = totals.get(project._id) ?? emptyTotals(project._id);
    const bytes = row.baselineBytes + row.prBytes + row.diffBytes;
    if (project.archivedAt !== undefined && bytes === 0) {
      continue;
    }
    const recentBuilds = [];
    for await (const build of ctx.db
      .query("builds")
      .withIndex("by_projectId_and_number", (q) =>
        q.eq("projectId", project._id),
      )
      .order("desc")) {
      if (
        build._creationTime < startedAt - DAY_MS ||
        recentBuilds.length === MAX_DAILY_BUILDS
      ) {
        break;
      }
      recentBuilds.push(build);
    }
    const fields = {
      accountId,
      projectId: project._id,
      day,
      baselineBytes: row.baselineBytes,
      prBytes: row.prBytes,
      diffBytes: row.diffBytes,
      builds: recentBuilds.length,
      snapshots: recentBuilds.reduce(
        (sum, build) =>
          sum +
          build.counts.unchanged +
          build.counts.changed +
          build.counts.added +
          build.counts.failed,
        0,
      ),
      uploadedImages: row.uploadedImages,
    };
    const existing = await ctx.db
      .query("usageDaily")
      .withIndex("by_projectId_and_day", (q) =>
        q.eq("projectId", project._id).eq("day", day),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("usageDaily", fields);
    } else {
      await ctx.db.replace("usageDaily", existing._id, fields);
    }
  }
}

export function toDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

const usageProject = v.object({
  name: v.string(),
  private: v.boolean(),
  archived: v.boolean(),
  prRetentionDays: v.number(),
  baselineBytes: v.number(),
  prBytes: v.number(),
  diffBytes: v.number(),
});

export const get = query({
  args: { login: v.string(), since: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      storage: storageUsage,
      countedOn: v.union(v.string(), v.null()),
      projects: v.array(usageProject),
      daily: v.array(v.object({ day: v.string(), bytes: v.number() })),
    }),
  ),
  handler: async (ctx, { login, since }) => {
    const found = await findMembership(ctx, login);
    if (
      found === null ||
      memberRole(found.account, found.user, found.membership) !== "owner"
    ) {
      return null;
    }
    const { account } = found;
    const rows = await ctx.db
      .query("usageDaily")
      .withIndex("by_accountId_and_day", (q) =>
        q.eq("accountId", account._id).gte("day", since),
      )
      .take(MAX_USAGE_ROWS);
    const daily = new Map<string, number>();
    for (const row of rows) {
      daily.set(
        row.day,
        (daily.get(row.day) ?? 0) +
          row.baselineBytes +
          row.prBytes +
          row.diffBytes,
      );
    }
    const countedOn = rows[rows.length - 1]?.day ?? null;
    const projects = [];
    for (const row of rows.filter((row) => row.day === countedOn)) {
      const project = await ctx.db.get("projects", row.projectId);
      if (project !== null) {
        projects.push({
          name: project.name,
          private: project.private,
          archived: project.archivedAt !== undefined,
          prRetentionDays: project.prRetentionDays,
          baselineBytes: row.baselineBytes,
          prBytes: row.prBytes,
          diffBytes: row.diffBytes,
        });
      }
    }
    return {
      storage: toStorageUsage(account),
      countedOn,
      projects,
      daily: [...daily].map(([day, bytes]) => ({ day, bytes })),
    };
  },
});
