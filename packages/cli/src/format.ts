import type { BuildCounts } from "./api";

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export function formatCounts(
  total: number,
  counts: Pick<BuildCounts, "unchanged" | "changed" | "added" | "removed"> &
    Partial<Pick<BuildCounts, "failed">>,
): string {
  const failed = counts.failed ?? 0;
  return `  ${formatCount(total)} snapshots  ${formatCount(counts.unchanged)} unchanged  ${formatCount(counts.changed)} changed  ${formatCount(counts.added)} added  ${formatCount(counts.removed)} removed${failed > 0 ? `  ${formatCount(failed)} failed` : ""}`;
}
