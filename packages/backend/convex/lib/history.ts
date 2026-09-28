import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

const BUILD_SCAN = 100;
const FLAKY_BUILDS = 10;
const FLAKY_MIN_FLIPS = 2;
const SAME_COMMIT_BUILDS = 10;

export function isBaselineCandidate(build: Doc<"builds">): boolean {
  return (
    build.status === "finalized" &&
    (build.conclusion === "approved" || build.conclusion === "no_changes") &&
    build.fullRows
  );
}

export async function findChanges(
  ctx: QueryCtx,
  project: Doc<"projects">,
  branch: string,
  buildName: string,
  snapshotName: string,
  limit: number,
): Promise<{ build: Doc<"builds">; snapshot: Doc<"snapshots"> }[]> {
  const changes = [];
  for (const build of await recentBuilds(ctx, project, branch)) {
    if (build.buildName !== buildName || build.status !== "finalized") {
      continue;
    }
    const snapshot = await ctx.db
      .query("snapshots")
      .withIndex("by_buildId_and_name", (q) =>
        q.eq("buildId", build._id).eq("name", snapshotName),
      )
      .unique();
    if (
      snapshot !== null &&
      (snapshot.diffStatus === "changed" || snapshot.diffStatus === "added")
    ) {
      changes.push({ build, snapshot });
      if (changes.length === limit) {
        break;
      }
    }
  }
  return changes;
}

export async function findFlaky(
  ctx: QueryCtx,
  project: Doc<"projects">,
  build: Doc<"builds">,
  snapshot: Doc<"snapshots">,
): Promise<{
  flips: number;
  builds: number;
  sameCommitBuild: number | null;
} | null> {
  const { imageId } = snapshot;
  if (snapshot.diffStatus !== "changed" || imageId === undefined) {
    return null;
  }
  const sameCommitBuild = await findSameCommitBuild(
    ctx,
    build,
    snapshot.name,
    imageId,
  );
  const imageIds = [imageId];
  for (const earlier of await recentBuilds(
    ctx,
    project,
    build.baselineBranch,
  )) {
    if (imageIds.length === FLAKY_BUILDS) {
      break;
    }
    if (
      earlier.buildName !== build.buildName ||
      earlier.status !== "finalized" ||
      earlier.number >= build.number
    ) {
      continue;
    }
    const row = await findRow(ctx, earlier, snapshot.name);
    if (row?.imageId !== undefined) {
      imageIds.push(row.imageId);
    }
  }
  let flips = 0;
  let flippedBack = false;
  const seen = new Set([imageIds[0]]);
  for (let index = 1; index < imageIds.length; index++) {
    const current = imageIds[index] as Id<"images">;
    if (current !== imageIds[index - 1]) {
      flips++;
      flippedBack ||= seen.has(current);
      seen.add(current);
    }
  }
  if (sameCommitBuild === null && (!flippedBack || flips < FLAKY_MIN_FLIPS)) {
    return null;
  }
  return { flips, builds: imageIds.length, sameCommitBuild };
}

async function findSameCommitBuild(
  ctx: QueryCtx,
  build: Doc<"builds">,
  snapshotName: string,
  imageId: Id<"images">,
): Promise<number | null> {
  const sameCommit = await ctx.db
    .query("builds")
    .withIndex("by_projectId_and_buildName_and_commitSha", (q) =>
      q
        .eq("projectId", build.projectId)
        .eq("buildName", build.buildName)
        .eq("commitSha", build.commitSha),
    )
    .order("desc")
    .take(SAME_COMMIT_BUILDS);
  for (const other of sameCommit) {
    if (other._id === build._id || other.status !== "finalized") {
      continue;
    }
    const row = await findRow(ctx, other, snapshotName);
    if (row?.imageId !== undefined && row.imageId !== imageId) {
      return other.number;
    }
  }
  return null;
}

function findRow(ctx: QueryCtx, build: Doc<"builds">, snapshotName: string) {
  return ctx.db
    .query("snapshots")
    .withIndex("by_buildId_and_name", (q) =>
      q.eq("buildId", build._id).eq("name", snapshotName),
    )
    .unique();
}

export async function recentBuilds(
  ctx: QueryCtx,
  project: Doc<"projects">,
  branch: string,
): Promise<Doc<"builds">[]> {
  return ctx.db
    .query("builds")
    .withIndex("by_projectId_and_branch", (q) =>
      q.eq("projectId", project._id).eq("branch", branch),
    )
    .order("desc")
    .take(BUILD_SCAN);
}
