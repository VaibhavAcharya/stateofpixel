import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { formatCount, formatPercent } from "../../lib/format";
import {
  DIFF_ICONS,
  type DiffStatus,
  REVIEW_ICONS,
  Skeleton,
  SnapshotName,
  TONE_TEXT,
} from "../ui";

import type { SnapshotRow } from "./types";

export function SnapshotGroup({
  status,
  label,
  count,
  open,
  onToggle,
  rows,
  loading,
  canLoadMore,
  onLoadMore,
  selectedId,
  linkParams,
  onSelect,
}: {
  status: DiffStatus;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  rows: SnapshotRow[];
  loading: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  selectedId: string | undefined;
  linkParams: { owner: string; repo: string; number: string };
  onSelect: () => void;
}) {
  const Caret = open ? CaretDownIcon : CaretRightIcon;
  const StatusIcon = DIFF_ICONS[status];

  return (
    <div className="pt-2 first:pt-0">
      <button
        type="button"
        aria-expanded={open}
        className="group flex h-7 w-full items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted hover:text-text"
        onClick={onToggle}
      >
        <StatusIcon size={12} weight="bold" className={TONE_TEXT[status]} />
        {label}
        <span className="ml-auto flex items-center gap-1.5 font-normal tabular-nums">
          {formatCount(count)}
          <Caret size={12} className="text-subtle group-hover:text-muted" />
        </span>
      </button>
      {open && (
        <ul>
          {rows.map((row) => (
            <SnapshotRowLink
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              linkParams={linkParams}
              onSelect={onSelect}
            />
          ))}
          {loading &&
            Array.from({ length: Math.min(count, 4) }, (_, index) => ({
              key: `${status}-${index}`,
            })).map(({ key }) => (
              <li key={key} className="flex h-8 items-center px-2">
                <Skeleton className="h-3 w-40 rounded-xs" />
              </li>
            ))}
        </ul>
      )}
      {open && canLoadMore && (
        <button
          type="button"
          className="flex h-8 w-full items-center px-2 text-xs text-link hover:underline"
          onClick={onLoadMore}
        >
          Load more
        </button>
      )}
    </div>
  );
}

function reviewTone(row: SnapshotRow) {
  return row.reviewState === "none"
    ? TONE_TEXT[row.diffStatus]
    : TONE_TEXT[row.reviewState];
}

function SnapshotRowLink({
  row,
  selected,
  linkParams,
  onSelect,
}: {
  row: SnapshotRow;
  selected: boolean;
  linkParams: { owner: string; repo: string; number: string };
  onSelect: () => void;
}) {
  const item = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) {
      item.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);
  const Icon =
    row.reviewState === "none"
      ? DIFF_ICONS[row.diffStatus]
      : REVIEW_ICONS[row.reviewState];
  const reviewLabel =
    row.reviewState === "none" ? "" : `, ${row.reviewState} review`;

  return (
    <li ref={item}>
      <Link
        to="/$owner/$repo/builds/$number/snapshots/$snapshotId"
        params={{ ...linkParams, snapshotId: row.id }}
        title={row.name}
        aria-current={selected ? "page" : undefined}
        aria-label={`${row.name}, ${row.diffStatus}${row.diffRatio === null ? "" : `, ${formatPercent(row.diffRatio)}`}${reviewLabel}`}
        onClick={onSelect}
        className={`relative flex h-8 items-center gap-2 rounded-sm px-2 text-sm transition-colors duration-100 hover:bg-hover ${
          selected
            ? "bg-hover before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-link"
            : ""
        }`}
      >
        <Icon
          size={14}
          weight={row.reviewState === "approved" ? "bold" : "regular"}
          className={`shrink-0 ${reviewTone(row)}`}
        />
        <SnapshotName name={row.name} className="flex-1" />
        {row.diffRatio !== null && (
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {formatPercent(row.diffRatio)}
          </span>
        )}
      </Link>
    </li>
  );
}
