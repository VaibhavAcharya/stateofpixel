import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { formatCount, formatPercent } from "../../lib/format";
import {
  DIFF_ICONS,
  type DiffStatus,
  REVIEW_ICONS,
  Skeleton,
  SnapshotName,
  TONE_TEXT,
} from "../ui";

import type { BuildLinkParams } from "./buildData";
import {
  onlyBrowsers,
  representative,
  type SnapshotItem,
  storyReviewState,
} from "./stories";
import type { SnapshotRow } from "./types";

export function SnapshotGroup({
  status,
  label,
  count,
  open,
  onToggle,
  entries,
  closedStories,
  onToggleStory,
  browsers,
  loading,
  canLoadMore,
  onLoadMore,
  selectedId,
  selectedStory,
  linkParams,
  onSelect,
}: {
  status: DiffStatus;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  entries: { item: SnapshotItem; some: boolean }[];
  closedStories: Set<string>;
  onToggleStory: (key: string) => void;
  browsers: string[];
  loading: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  selectedId: string | undefined;
  selectedStory?: string;
  linkParams: BuildLinkParams | null;
  onSelect: (row: SnapshotRow, story?: string) => void;
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
          {entries.map(({ item, some }, index) => [
            some !== entries[index - 1]?.some &&
              entries.some((entry) => entry.some) && (
                <li
                  key={some ? "some" : "all"}
                  className="flex h-6 items-end px-2 pb-1 text-2xs font-medium text-subtle"
                >
                  {some ? "Some browsers" : "All browsers"}
                </li>
              ),
            item.kind === "row" ? (
              <SnapshotRowLink
                key={item.row.id}
                row={item.row}
                selected={item.row.id === selectedId}
                linkParams={linkParams}
                onSelect={onSelect}
              />
            ) : (
              <StoryRows
                key={item.key}
                story={item}
                open={!closedStories.has(item.key)}
                onToggle={() => onToggleStory(item.key)}
                only={onlyBrowsers(item.rows, browsers)}
                selectedId={selectedId}
                focused={selectedStory === item.key}
                linkParams={linkParams}
                onSelect={onSelect}
              />
            ),
          ])}
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

function scrollIntoList(element: HTMLElement, list: HTMLElement) {
  const row = element.getBoundingClientRect();
  const view = list.getBoundingClientRect();
  if (row.top < view.top) {
    list.scrollTop -= view.top - row.top;
  } else if (row.bottom > view.bottom) {
    list.scrollTop += row.bottom - view.bottom;
  }
}

function reviewTone(row: SnapshotRow) {
  return row.reviewState === "none"
    ? TONE_TEXT[row.diffStatus]
    : TONE_TEXT[row.reviewState];
}

function rowClass(selected: boolean) {
  return `relative flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors duration-100 hover:bg-hover ${
    selected
      ? "bg-hover before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-link"
      : ""
  }`;
}

function useScrollIntoList(selected: boolean) {
  const item = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const list = item.current?.closest("nav");
    if (selected && item.current && list) {
      scrollIntoList(item.current, list);
    }
  }, [selected]);
  return item;
}

function OnlyLabel({ browsers }: { browsers: string[] }) {
  return (
    <span className="shrink-0 rounded-xs bg-changed-bg px-1.5 text-2xs leading-5 font-medium text-changed">
      {browsers.join(", ")}
    </span>
  );
}

function RowLink({
  row,
  selected,
  linkParams,
  onSelect,
  label,
  children,
}: {
  row: SnapshotRow;
  selected: boolean;
  linkParams: BuildLinkParams | null;
  onSelect: (row: SnapshotRow, story?: string) => void;
  label: string;
  children: ReactNode;
}) {
  const props = {
    title: row.name,
    "aria-label": label,
    onClick: () => onSelect(row),
    className: rowClass(selected),
  };
  return linkParams === null ? (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      {...props}
    >
      {children}
    </button>
  ) : (
    <Link
      to="/$owner/$repo/builds/$number/snapshots/$snapshotId"
      params={{ ...linkParams, snapshotId: row.id }}
      aria-current={selected ? "page" : undefined}
      {...props}
    >
      {children}
    </Link>
  );
}

function rowLabel(row: SnapshotRow, name = row.name) {
  const ratio =
    row.diffRatio === null ? "" : `, ${formatPercent(row.diffRatio)}`;
  const review =
    row.reviewState === "none" ? "" : `, ${row.reviewState} review`;
  return `${name}, ${row.diffStatus}${ratio}${review}`;
}

function SnapshotRowLink({
  row,
  variant = false,
  selected,
  linkParams,
  onSelect,
}: {
  row: SnapshotRow;
  variant?: boolean;
  selected: boolean;
  linkParams: BuildLinkParams | null;
  onSelect: (row: SnapshotRow, story?: string) => void;
}) {
  const item = useScrollIntoList(selected);
  const Icon =
    row.reviewState === "none"
      ? DIFF_ICONS[row.diffStatus]
      : REVIEW_ICONS[row.reviewState];
  const suffix = variantName(row.name);

  return (
    <li ref={item} className={variant ? "pl-6" : undefined}>
      <RowLink
        row={row}
        selected={selected}
        linkParams={linkParams}
        onSelect={onSelect}
        label={rowLabel(row)}
      >
        <Icon
          size={14}
          weight={row.reviewState === "approved" ? "bold" : "regular"}
          className={`shrink-0 ${reviewTone(row)}`}
        />
        {variant && suffix !== null ? (
          <span className="mono flex-1 truncate text-muted tabular-nums">
            {suffix}
          </span>
        ) : (
          <SnapshotName name={row.name} className="flex-1" />
        )}
        {row.diffRatio !== null && (
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {formatPercent(row.diffRatio)}
          </span>
        )}
      </RowLink>
    </li>
  );
}

function variantName(name: string) {
  return /\[([^\]]+)\]$/.exec(name)?.[1] ?? null;
}

function StoryRows({
  story,
  open,
  onToggle,
  only,
  selectedId,
  focused,
  linkParams,
  onSelect,
}: {
  story: Extract<SnapshotItem, { kind: "story" }>;
  open: boolean;
  onToggle: () => void;
  only: string[] | null;
  selectedId: string | undefined;
  focused: boolean;
  linkParams: BuildLinkParams | null;
  onSelect: (row: SnapshotRow, story?: string) => void;
}) {
  const contains = story.rows.some((row) => row.id === selectedId);
  const selected = contains && (!open || focused);
  const item = useScrollIntoList(selected);
  const state = storyReviewState(story.rows);
  const first = representative(story);
  const Icon =
    state === "none" ? DIFF_ICONS[first.diffStatus] : REVIEW_ICONS[state];
  const tone =
    state === "none" ? TONE_TEXT[first.diffStatus] : TONE_TEXT[state];
  const ratios = story.rows.flatMap((row) => row.diffRatio ?? []);
  const largest = ratios.length === 0 ? null : Math.max(...ratios);
  const pending = story.rows.filter((row) => row.reviewState === "pending");
  const Caret = open ? CaretDownIcon : CaretRightIcon;

  return (
    <>
      <li ref={item} className="relative">
        <RowLink
          row={first}
          selected={selected}
          linkParams={linkParams}
          onSelect={(row) => onSelect(row, story.key)}
          label={`${story.name}, ${formatCount(story.rows.length)} snapshots${pending.length > 0 ? `, ${formatCount(pending.length)} to review` : ""}`}
        >
          <Icon
            size={14}
            weight={state === "approved" ? "bold" : "regular"}
            className={`shrink-0 ${tone}`}
          />
          <SnapshotName name={story.name} className="min-w-0 flex-1" />
          {only !== null && <OnlyLabel browsers={only} />}
          {largest !== null && (
            <span className="shrink-0 text-xs text-muted tabular-nums">
              {formatPercent(largest)}
            </span>
          )}
          <span className="w-10 shrink-0" />
        </RowLink>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} the ${formatCount(story.rows.length)} snapshots of ${story.name}`}
          className="absolute inset-y-1 right-1 flex w-10 items-center justify-end gap-1 rounded-xs pr-1.5 text-xs text-subtle tabular-nums hover:bg-surface hover:text-text"
          onClick={onToggle}
        >
          {formatCount(story.rows.length)}
          <Caret size={10} weight="bold" />
        </button>
      </li>
      {open &&
        story.rows.map((row) => (
          <SnapshotRowLink
            key={row.id}
            row={row}
            variant
            selected={!focused && row.id === selectedId}
            linkParams={linkParams}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
