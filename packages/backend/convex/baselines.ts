import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { isBaselineCandidate } from "./builds";
import { findChanges, recentBuilds } from "./lib/history";
import { imageInfo, toImageInfo } from "./lib/images";
import { findReadableProject } from "./lib/permissions";
import { diffStatus } from "./schema";

const MAX_HISTORY = 50;

const DEFAULT_BUILD_NAME = "default";

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
  args: {
    owner: v.string(),
    name: v.string(),
    buildName: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      buildNames: v.array(v.string()),
      buildName: v.string(),
      build: v.union(
        v.null(),
        v.object({ number: v.number(), commitSha: v.string() }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const project = await findReadableProject(ctx, args.owner, args.name);
    if (project === null) {
      return null;
    }
    const builds = await recentBuilds(ctx, project, project.defaultBranch);
    const { buildNames, buildName } = pickBuildName(builds, args.buildName);
    const baseline = builds.find(
      (build) => build.buildName === buildName && isBaselineCandidate(build),
    );
    return {
      buildNames,
      buildName,
      build:
        baseline === undefined
          ? null
          : { number: baseline.number, commitSha: baseline.commitSha },
    };
  },
});

export const list = query({
  args: {
    owner: v.string(),
    name: v.string(),
    buildName: v.string(),
    prefix: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({ name: v.string(), image: imageInfo }),
  ),
  handler: async (ctx, args) => {
    const baseline = await findBaseline(
      ctx,
      args.owner,
      args.name,
      args.buildName,
    );
    if (baseline === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const prefix = args.prefix ?? "";
    const page = await ctx.db
      .query("snapshots")
      .withIndex("by_buildId_and_name", (q) =>
        prefix === ""
          ? q.eq("buildId", baseline._id)
          : q
              .eq("buildId", baseline._id)
              .gte("name", prefix)
              .lt("name", `${prefix}\uffff`),
      )
      .filter((q) => q.neq(q.field("diffStatus"), "removed"))
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (snapshot) => ({
          name: snapshot.name,
          image: await toImageInfo(ctx, snapshot.imageId),
        })),
      ),
    };
  },
});

export const history = query({
  args: {
    owner: v.string(),
    name: v.string(),
    buildName: v.optional(v.string()),
    snapshotName: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      buildName: v.string(),
      entries: v.array(
        v.object({
          buildNumber: v.number(),
          commitSha: v.string(),
          commitMessage: v.string(),
          createdAt: v.number(),
          diffStatus,
          mergedPrNumber: v.union(v.number(), v.null()),
          approvedBy: v.union(v.string(), v.null()),
          image: imageInfo,
        }),
      ),
    }),
  ),
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
        mergedPrNumber: build.mergedPrNumber ?? null,
        approvedBy: await findPrApprover(ctx, build, snapshot),
        image: await toImageInfo(ctx, snapshot.imageId),
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
  if (mergedPrNumber === undefined || imageId === undefined) {
    return null;
  }
  const approval = await ctx.db
    .query("approvedImages")
    .withIndex("by_projectId_and_buildName_and_prNumber_and_imageId", (q) =>
      q
        .eq("projectId", build.projectId)
        .eq("buildName", build.buildName)
        .eq("prNumber", mergedPrNumber)
        .eq("imageId", imageId),
    )
    .first();
  const review =
    approval === null ? null : await ctx.db.get("reviews", approval.reviewId);
  const user =
    review?.userId === undefined
      ? null
      : await ctx.db.get("users", review.userId);
  return user?.login ?? null;
}
