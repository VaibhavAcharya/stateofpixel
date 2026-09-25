import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

const BUILD_SCAN = 100;

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
