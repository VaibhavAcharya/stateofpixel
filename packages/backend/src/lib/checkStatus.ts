import type { Doc } from "../dataModel.ts";

export type StatusState = "pending" | "success" | "failure" | "error";

export type StatusBuild = Pick<
  Doc<"builds">,
  | "status"
  | "conclusion"
  | "counts"
  | "shardsTotal"
  | "doneShardIndexes"
  | "storageBlocked"
  | "baselineBuildId"
  | "autoApproved"
>;

export function toStatus(build: StatusBuild): {
  state: StatusState;
  description: string;
} {
  const { counts } = build;
  const changes = counts.changed + counts.added;
  const status = (state: StatusState, description: string) => ({
    state,
    description,
  });

  if (build.status === "pending") {
    const shards =
      build.shardsTotal === null || build.shardsTotal === 1
        ? ""
        : ` (${build.doneShardIndexes.length} of ${build.shardsTotal} shards)`;
    return status("pending", `Waiting for screenshots${shards}`);
  }
  if (build.status === "expired") {
    return status("error", "Build never finished");
  }
  if (build.status === "error") {
    return status("error", "Upload failed, see CI logs");
  }
  if (build.storageBlocked && build.conclusion !== "no_changes") {
    return status("success", "Storage limit reached, not compared");
  }
  switch (build.conclusion) {
    case "no_changes":
      return status("success", "No visual changes");
    case "approved":
      if (build.baselineBuildId === null) {
        return status(
          "success",
          `Baseline created, ${plural(counts.added, "snapshot")}`,
        );
      }
      return status(
        "success",
        build.autoApproved
          ? `Baseline updated, ${plural(changes, "change")}`
          : `${plural(changes, "change")} approved`,
      );
    case "rejected":
      return status("failure", `${plural(counts.rejected, "change")} rejected`);
    default:
      return status(
        "pending",
        counts.failed > 0
          ? `${plural(counts.pending, "change")} to review, ${formatCount(counts.failed)} failed`
          : `${plural(counts.pending, "change")} to review`,
      );
  }
}

function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}
