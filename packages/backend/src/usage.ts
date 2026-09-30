import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { z } from "zod";
import { findMembership, memberRole, toStorageUsage } from "./accounts.ts";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { isKeptBranch } from "./lib/matchesBranch.ts";
import {
  accounts,
  builds as buildsTable,
  images,
  projects as projectsTable,
  snapshots as snapshotsTable,
  usageDaily,
} from "./schema.ts";
import {
  internalMutation,
  type MutationCtx,
  paginate,
  query,
} from "./server.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;
const SNAPSHOTS_PER_IMAGE = 50;
const MAX_DAILY_BUILDS = 1000;
const MAX_PROJECTS = 1000;
const MAX_USAGE_ROWS = 10_000;

const projectTotals = z.object({
  projectId: z.string(),
  baselineBytes: z.number(),
  prBytes: z.number(),
  diffBytes: z.number(),
  uploadedImages: z.number(),
});

type ProjectTotals = z.infer<typeof projectTotals>;

export const count = internalMutation({
  args: {
    accountId: z.string().optional(),
    cursor: z.string().nullable().optional(),
    totals: z.array(projectTotals).optional(),
    startedAt: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const account = first(
      args.accountId === undefined
        ? await ctx.db
            .select()
            .from(accounts)
            .orderBy(asc(accounts._creationTime), asc(accounts._id))
            .limit(1)
        : await ctx.db
            .select()
            .from(accounts)
            .where(eq(accounts._id, args.accountId)),
    );
    if (account === null) {
      return null;
    }
    const totals = new Map(
      (args.totals ?? []).map((row) => [row.projectId, row]),
    );
    const page = await paginate(
      { numItems: PAGE_SIZE, cursor: args.cursor ?? null },
      (limit, offset) =>
        ctx.db
          .select()
          .from(images)
          .where(eq(images.accountId, account._id))
          .orderBy(asc(images.hash), asc(images._creationTime), asc(images._id))
          .limit(limit)
          .offset(offset),
    );
    const builds = new Map<Id<"builds">, Doc<"builds"> | null>();
    const projects = new Map<Id<"projects">, Doc<"projects"> | null>();
    for (const image of page.page) {
      const { projectId, baseline } =
        image.projectId === null
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
    const next = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(gt(accounts._creationTime, account._creationTime))
        .orderBy(asc(accounts._creationTime), asc(accounts._id))
        .limit(1),
    );
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
  const snapshots = await ctx.db
    .select()
    .from(snapshotsTable)
    .where(
      image.kind === "diff"
        ? eq(snapshotsTable.diffImageId, image._id)
        : eq(snapshotsTable.imageId, image._id),
    )
    .orderBy(asc(snapshotsTable._creationTime), asc(snapshotsTable._id))
    .limit(SNAPSHOTS_PER_IMAGE);
  let projectId: Id<"projects"> | undefined;
  let baseline = image.baseline === true;
  for (const snapshot of snapshots) {
    if (!builds.has(snapshot.buildId)) {
      builds.set(
        snapshot.buildId,
        first(
          await ctx.db
            .select()
            .from(buildsTable)
            .where(eq(buildsTable._id, snapshot.buildId)),
        ),
      );
    }
    const build = builds.get(snapshot.buildId) ?? null;
    if (build === null) {
      continue;
    }
    if (!projects.has(build.projectId)) {
      projects.set(
        build.projectId,
        first(
          await ctx.db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable._id, build.projectId)),
        ),
      );
    }
    const project = projects.get(build.projectId) ?? null;
    projectId ??= build.projectId;
    baseline ||= project !== null && isKeptBranch(project, build.branch);
  }
  if (projectId !== undefined) {
    await ctx.db
      .update(images)
      .set({ projectId, baseline })
      .where(eq(images._id, image._id));
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
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.accountId, accountId))
    .orderBy(asc(projectsTable._creationTime), asc(projectsTable._id))
    .limit(MAX_PROJECTS);
  for (const project of projects) {
    const row = totals.get(project._id) ?? emptyTotals(project._id);
    const bytes = row.baselineBytes + row.prBytes + row.diffBytes;
    if (project.archivedAt !== null && bytes === 0) {
      continue;
    }
    const recentBuilds = [];
    for (const build of await ctx.db
      .select()
      .from(buildsTable)
      .where(eq(buildsTable.projectId, project._id))
      .orderBy(desc(buildsTable.number), desc(buildsTable._creationTime))
      .limit(MAX_DAILY_BUILDS + 1)) {
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
    const existing = first(
      await ctx.db
        .select()
        .from(usageDaily)
        .where(
          and(eq(usageDaily.projectId, project._id), eq(usageDaily.day, day)),
        )
        .limit(1),
    );
    if (existing === null) {
      await ctx.db.insert(usageDaily).values(fields);
    } else {
      await ctx.db
        .update(usageDaily)
        .set(fields)
        .where(eq(usageDaily._id, existing._id));
    }
  }
}

export function toDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export const get = query({
  args: { login: z.string(), since: z.string() },
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
      .select()
      .from(usageDaily)
      .where(
        and(eq(usageDaily.accountId, account._id), gte(usageDaily.day, since)),
      )
      .orderBy(
        asc(usageDaily.day),
        asc(usageDaily._creationTime),
        asc(usageDaily._id),
      )
      .limit(MAX_USAGE_ROWS);
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
      const project = first(
        await ctx.db
          .select()
          .from(projectsTable)
          .where(eq(projectsTable._id, row.projectId)),
      );
      if (project !== null) {
        projects.push({
          name: project.name,
          private: project.private,
          archived: project.archivedAt !== null,
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
