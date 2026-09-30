import { and, asc, eq, like, ne } from "drizzle-orm";
import { z } from "zod";
import type { Doc } from "./dataModel.ts";
import { first } from "./db/index.ts";
import {
  findChanges,
  isBaselineCandidate,
  recentBuilds,
} from "./lib/history.ts";
import { toImageInfo } from "./lib/images.ts";
import { findReadableProject } from "./lib/permissions.ts";
import {
  approvedImages,
  connections,
  DEFAULT_BUILD_NAME,
  projects,
  reviews,
  snapshots,
} from "./schema.ts";
import {
  paginate,
  paginationOptsValidator,
  type QueryCtx,
  query,
} from "./server.ts";

const MAX_HISTORY = 50;

function pickBuildName(
  builds: Doc<"builds">[],
  requested: string | undefined,
): { buildNames: string[]; buildName: string } {
  const buildNames = [
    ...new Set(builds.map((build) => build.buildName)),
  ].sort();
  const buildName =
    requested ??
    (buildNames.includes(DEFAULT_BUILD_NAME)
      ? DEFAULT_BUILD_NAME
      : (buildNames[0] ?? DEFAULT_BUILD_NAME));
  return { buildNames, buildName };
}

async function findBaseline(
  ctx: QueryCtx,
  owner: string,
  name: string,
  buildName: string,
): Promise<Doc<"builds"> | null> {
  const project = await findReadableProject(ctx, owner, name);
  if (project === null) {
    return null;
  }
  const builds = await recentBuilds(ctx, project, project.defaultBranch);
  return (
    builds.find(
      (build) => build.buildName === buildName && isBaselineCandidate(build),
    ) ?? null
  );
}

export const current = query({
  args: { owner: z.string(), name: z.string() },
  handler: async (ctx, args) => {
    const project = await findReadableProject(ctx, args.owner, args.name);
    if (project === null) {
      return null;
    }
    const builds = await recentBuilds(ctx, project, project.defaultBranch);
    const { buildNames } = pickBuildName(builds, undefined);
    return buildNames.map((buildName) => {
      const baseline = builds.find(
        (build) => build.buildName === buildName && isBaselineCandidate(build),
      );
      return {
        buildName,
        build:
          baseline === undefined
            ? null
            : { number: baseline.number, commitSha: baseline.commitSha },
      };
    });
  },
});

export const list = query({
  args: {
    owner: z.string(),
    name: z.string(),
    buildName: z.string(),
    prefix: z.string().optional(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const baseline = await findBaseline(
      ctx,
      args.owner,
      args.name,
      args.buildName,
    );
    const project =
      baseline === null
        ? null
        : first(
            await ctx.db
              .select()
              .from(projects)
              .where(eq(projects._id, baseline.projectId)),
          );
    if (baseline === null || project === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const prefix = args.prefix ?? "";
    const page = await paginate(args.paginationOpts, (limit, offset) =>
      ctx.db
        .select()
        .from(snapshots)
        .where(
          and(
            eq(snapshots.buildId, baseline._id),
            prefix === ""
              ? undefined
              : like(snapshots.name, `${escapeLike(prefix)}%`),
            ne(snapshots.diffStatus, "removed"),
          ),
        )
        .orderBy(
          asc(snapshots.name),
          asc(snapshots._creationTime),
          asc(snapshots._id),
        )
        .limit(limit)
        .offset(offset),
    );
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (snapshot) => ({
          name: snapshot.name,
          image: await toImageInfo(ctx, project, snapshot.imageId),
        })),
      ),
    };
  },
});

export const history = query({
  args: {
    owner: z.string(),
    name: z.string(),
    buildName: z.string().optional(),
    snapshotName: z.string(),
  },
  handler: async (ctx, args) => {
    const project = await findReadableProject(ctx, args.owner, args.name);
    if (project === null) {
      return null;
    }
    const { buildName } = pickBuildName(
      await recentBuilds(ctx, project, project.defaultBranch),
      args.buildName,
    );
    const changes = await findChanges(
      ctx,
      project,
      project.defaultBranch,
      buildName,
      args.snapshotName,
      MAX_HISTORY,
    );
    const entries = await Promise.all(
      changes.map(async ({ build, snapshot }) => ({
        buildNumber: build.number,
        commitSha: build.commitSha,
        commitMessage: build.commitMessage,
        createdAt: build._creationTime,
        diffStatus: snapshot.diffStatus,
        mergedPrNumber: build.mergedPrNumber,
        approvedBy: await findPrApprover(ctx, build, snapshot),
        image: await toImageInfo(ctx, project, snapshot.imageId),
      })),
    );
    return { buildName, entries };
  },
});

async function findPrApprover(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<string | null> {
  const { mergedPrNumber } = build;
  const { imageId } = snapshot;
  if (mergedPrNumber === null || imageId === null) {
    return null;
  }
  const approval = first(
    await ctx.db
      .select()
      .from(approvedImages)
      .where(
        and(
          eq(approvedImages.projectId, build.projectId),
          eq(approvedImages.buildName, build.buildName),
          eq(approvedImages.prNumber, mergedPrNumber),
          eq(approvedImages.imageId, imageId),
        ),
      )
      .orderBy(asc(approvedImages._creationTime), asc(approvedImages._id))
      .limit(1),
  );
  const review =
    approval === null
      ? null
      : first(
          await ctx.db
            .select()
            .from(reviews)
            .where(eq(reviews._id, approval.reviewId)),
        );
  const connection =
    review === null || review.userId === null
      ? null
      : first(
          await ctx.db
            .select({ login: connections.login })
            .from(connections)
            .where(
              and(
                eq(connections.userId, review.userId),
                eq(connections.provider, "github"),
              ),
            ),
        );
  return connection?.login ?? null;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
