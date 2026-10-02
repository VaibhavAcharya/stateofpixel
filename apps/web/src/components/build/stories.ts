import type { ReviewState } from "../ui";
import type { SnapshotRow } from "./types";

const VARIANT_SUFFIX = /^(.*?)\s*\[[^\]]+\]$/;

export type SnapshotItem =
  | { kind: "row"; row: SnapshotRow }
  | { kind: "story"; key: string; name: string; rows: SnapshotRow[] };

export function storyName(name: string): string {
  return VARIANT_SUFFIX.exec(name)?.[1] ?? name;
}

export function groupStories(rows: SnapshotRow[]): SnapshotItem[] {
  const stories: { key: string; name: string; rows: SnapshotRow[] }[] = [];
  for (const row of rows) {
    const name = storyName(row.name);
    const last = stories.at(-1);
    if (last?.name === name) {
      last.rows.push(row);
    } else {
      stories.push({ key: `${row.diffStatus}:${name}`, name, rows: [row] });
    }
  }
  return stories.map(
    (story): SnapshotItem =>
      story.rows.length === 1 && story.rows[0] !== undefined
        ? { kind: "row", row: story.rows[0] }
        : {
            kind: "story",
            ...story,
            rows: [...story.rows].sort((a, b) =>
              a.name.localeCompare(b.name, "en", { numeric: true }),
            ),
          },
  );
}

export function itemRows(item: SnapshotItem): SnapshotRow[] {
  return item.kind === "row" ? [item.row] : item.rows;
}

export function representative(item: SnapshotItem): SnapshotRow {
  const rows = itemRows(item);
  const pending = rows.filter((row) => row.reviewState === "pending");
  const candidates = pending.length > 0 ? pending : rows;
  return candidates.reduce((best, row) =>
    (row.diffRatio ?? 0) > (best.diffRatio ?? 0) ? row : best,
  );
}

export function storyReviewState(rows: SnapshotRow[]): ReviewState {
  const states = new Set(rows.map((row) => row.reviewState));
  if (states.has("rejected")) {
    return "rejected";
  }
  if (states.has("pending")) {
    return "pending";
  }
  return states.has("approved") ? "approved" : "none";
}

export function onlyBrowsers(
  rows: SnapshotRow[],
  buildBrowsers: string[],
): string[] | null {
  const browsers = [
    ...new Set(rows.flatMap((row) => row.browser ?? [])),
  ].sort();
  return buildBrowsers.length > 1 &&
    browsers.length > 0 &&
    browsers.length < buildBrowsers.length
    ? browsers
    : null;
}

export function someBrowsersFirst(
  items: SnapshotItem[],
  buildBrowsers: string[],
): { item: SnapshotItem; some: boolean }[] {
  const marked = items.map((item) => ({
    item,
    some: onlyBrowsers(itemRows(item), buildBrowsers) !== null,
  }));
  return [
    ...marked.filter((entry) => entry.some),
    ...marked.filter((entry) => !entry.some),
  ];
}
