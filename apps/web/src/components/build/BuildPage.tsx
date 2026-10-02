import {
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import type { Id } from "@stateofpixel/backend/dataModel";
import {
  type CSSProperties,
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { track as trackEvent } from "../../lib/analytics";
import { ZOOM_STEP } from "../../lib/canvasView";
import { errorCode } from "../../lib/errorCode";
import { formatCount } from "../../lib/format";
import { useImageUrl } from "../../lib/useImageUrl";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarWidth,
} from "../../lib/useSidebarWidth";
import { SelectMenu } from "../ListControls";
import { Toasts, useToasts } from "../Toast";
import {
  buttonClass,
  type DiffStatus,
  LeadCopy,
  Skeleton,
  Spinner,
  Tooltip,
} from "../ui";
import { DIFF_COLORS, MODES, useViewerSettings } from "../Viewer";
import { Banners, BuildHeader, buildVerdict } from "./BuildHeader";
import { type ReviewAction, useBuildData } from "./buildData";
import { SnapshotDetail } from "./SnapshotDetail";
import { SnapshotGroup } from "./SnapshotGroup";
import {
  groupStories,
  itemRows,
  representative,
  type SnapshotItem,
  someBrowsersFirst,
} from "./stories";
import type { Build, SnapshotRow } from "./types";

const GROUPS: { status: DiffStatus; label: string }[] = [
  { status: "changed", label: "Changed" },
  { status: "added", label: "Added" },
  { status: "removed", label: "Removed" },
  { status: "failed", label: "Failed" },
  { status: "unchanged", label: "Unchanged" },
];

const PREFETCH_PENDING = 3;
const SNAPSHOTS_PER_CALL = 100;

const ACTION_VERBS: Record<ReviewAction, string> = {
  approve: "approve",
  reject: "reject",
  undo: "undo the review of",
};

export const ShortcutsContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function PrefetchSnapshot({
  owner,
  repo,
  number,
  snapshotId,
}: {
  owner: string;
  repo: string;
  number: number;
  snapshotId: Id<"snapshots">;
}) {
  const snapshot = useBuildData().useSnapshot({
    owner,
    name: repo,
    number,
    snapshotId,
  });
  const image = useImageUrl(snapshot?.image?.url);
  const baselineImage = useImageUrl(snapshot?.baselineImage?.url);
  const diffImage = useImageUrl(snapshot?.diffImage?.url);
  useEffect(() => {
    for (const url of [image, baselineImage, diffImage]) {
      if (url !== undefined) {
        new Image().src = url;
      }
    }
  }, [image, baselineImage, diffImage]);
  return null;
}

export function BuildPage({
  build,
  canWrite,
  owner,
  repo,
  links = true,
  headings = true,
  keyboard = true,
  track = trackEvent,
}: {
  build: Build;
  canWrite: boolean;
  owner: string;
  repo: string;
  links?: boolean;
  headings?: boolean;
  keyboard?: boolean;
  track?: typeof trackEvent;
}) {
  const [filter, setFilter] = useState("");
  const [browser, setBrowser] = useState<string>();
  const [collapsed, setCollapsed] = useState<Set<DiffStatus>>(
    () => new Set(["unchanged"]),
  );
  const [closedStories, setClosedStories] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedStory, setSelectedStory] = useState<string>();
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } =
    useContext(ShortcutsContext);
  const [listOpen, setListOpen] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const filterInput = useRef<HTMLInputElement>(null);
  const settings = useViewerSettings();
  const { toasts, show, dismiss } = useToasts();
  const data = useBuildData();
  const linkParams = { owner, repo, number: String(build.number) };
  const { snapshotId, select: selectId } = data.useSelection(linkParams);
  const applyReview = data.useApplyReview();
  const addComment = data.useAddComment();
  const groups = data.useSnapshotGroups(
    build.buildId,
    build.counts,
    !collapsed.has("unchanged"),
  );
  const canReview =
    canWrite && build.status === "finalized" && !build.superseded;

  const needle = filter.trim().toLowerCase();
  const activeBrowser =
    browser !== undefined && build.browsers.includes(browser)
      ? browser
      : undefined;
  const visible = (rows: SnapshotRow[]) =>
    rows.filter(
      (row) =>
        (needle === "" || row.name.toLowerCase().includes(needle)) &&
        (activeBrowser === undefined || row.browser === activeBrowser),
    );
  const groupEntries = (status: DiffStatus) =>
    someBrowsersFirst(
      groupStories(visible(groups[status].results)),
      activeBrowser === undefined ? build.browsers : [],
    );
  const groupItems = (status: DiffStatus) =>
    groupEntries(status).map((entry) => entry.item);
  const ordered = GROUPS.flatMap((group) =>
    collapsed.has(group.status)
      ? []
      : groupItems(group.status).flatMap((item): SnapshotItem[] =>
          item.kind === "story" &&
          !closedStories.has(item.key) &&
          !(
            selectedStory === item.key &&
            item.rows.some((row) => row.id === snapshotId)
          )
            ? item.rows.map((row) => ({ kind: "row", row }))
            : [item],
        ),
  );
  const currentIndex = ordered.findIndex((item) =>
    itemRows(item).some((row) => row.id === snapshotId),
  );
  const current = currentIndex === -1 ? undefined : ordered[currentIndex];
  const reviewableRows = (item: SnapshotItem | undefined) =>
    item === undefined
      ? []
      : itemRows(item).filter((row) => row.reviewState !== "none");

  const toggleStory = (key: string) =>
    setClosedStories((value) => {
      const next = new Set(value);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  const currentStoryKey = () => {
    const row = current === undefined ? undefined : itemRows(current)[0];
    if (row === undefined) {
      return undefined;
    }
    return groupItems(row.diffStatus).find(
      (item) =>
        item.kind === "story" &&
        item.rows.some((storyRow) => storyRow.id === snapshotId),
    );
  };

  const toggleGroup = (status: DiffStatus) =>
    setCollapsed((value) => {
      const next = new Set(value);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });

  const select = (item: SnapshotItem | undefined) => {
    if (item !== undefined) {
      setSelectedStory(undefined);
      settings.setShowBaseline(false);
      settings.setView(null);
      selectId(representative(item).id);
    }
  };
  const selectNext = () => select(ordered[currentIndex + 1] ?? ordered[0]);
  const selectPrevious = () =>
    select(ordered[currentIndex - 1] ?? ordered[ordered.length - 1]);

  const firstItem = ordered.find(
    (item) => itemRows(item)[0]?.diffStatus !== "unchanged",
  );
  const firstId =
    firstItem === undefined ? undefined : representative(firstItem).id;
  useEffect(() => {
    if (snapshotId === undefined && firstId !== undefined) {
      selectId(firstId, { replace: true });
    }
  });

  const previousConclusion = useRef(build.conclusion);
  useEffect(() => {
    if (
      previousConclusion.current === "changes" &&
      build.conclusion === "approved"
    ) {
      show("success", "Build approved, check updated on GitHub");
    }
    previousConclusion.current = build.conclusion;
  }, [build.conclusion, show]);

  const review = (action: ReviewAction, item: SnapshotItem | undefined) => {
    const rows = reviewableRows(item);
    if (!canReview || item === undefined || rows.length === 0) {
      return;
    }
    const name = item.kind === "row" ? item.row.name : item.name;
    track("Review", { action, count: rows.length });
    const calls = [];
    for (let start = 0; start < rows.length; start += SNAPSHOTS_PER_CALL) {
      calls.push(
        applyReview({
          buildId: build.buildId,
          snapshotIds: rows
            .slice(start, start + SNAPSHOTS_PER_CALL)
            .map((row) => row.id),
          action,
        }),
      );
    }
    Promise.all(calls).catch((error: unknown) => {
      const reason =
        errorCode(error) === "build_not_reviewable"
          ? " This build can no longer be reviewed."
          : " Your change was undone.";
      show("error", `Could not ${ACTION_VERBS[action]} ${name}.${reason}`);
    });
  };

  const reviewAndAdvance = (action: "approve" | "reject") => {
    if (!canReview || reviewableRows(current).length === 0) {
      return;
    }
    review(action, current);
    select(nextPending);
  };

  const openComments = () => {
    if (current !== undefined) {
      setCommenting(true);
    }
  };

  const pendingAhead = [
    ...ordered.slice(currentIndex + 1),
    ...ordered.slice(0, currentIndex),
  ]
    .filter((item) =>
      itemRows(item).some((row) => row.reviewState === "pending"),
    )
    .slice(0, PREFETCH_PENDING);
  const nextPending = pendingAhead[0];
  const neighbours = new Set(
    [
      ordered[currentIndex + 1] ?? ordered[0],
      ordered[currentIndex - 1] ?? ordered[ordered.length - 1],
      ...pendingAhead,
    ].flatMap((item) => {
      if (item === undefined) {
        return [];
      }
      const id = representative(item).id;
      return id === snapshotId ? [] : [id];
    }),
  );

  const reviewAll = (action: ReviewAction) => {
    if (!canReview) {
      return;
    }
    track("Review all", { action });
    applyReview({ buildId: build.buildId, snapshotIds: "all", action }).catch(
      () => show("error", `Could not ${ACTION_VERBS[action]} the build.`),
    );
  };

  useEffect(() => {
    if (!keyboard) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest(
          "input:not([type=range]), textarea, select, [contenteditable], dialog",
        ) ||
        shortcutsOpen ||
        commenting
      ) {
        return;
      }
      const mode = MODES.find((item) => item.key === event.key);
      if (mode !== undefined) {
        settings.setMode(mode.value);
        return;
      }
      switch (event.key) {
        case "Escape":
          setListOpen(false);
          break;
        case "j":
          selectNext();
          break;
        case "k":
          selectPrevious();
          break;
        case "a":
          reviewAndAdvance("approve");
          break;
        case "A":
          reviewAll("approve");
          break;
        case "R":
          reviewAll("reject");
          break;
        case "U":
          if (buildVerdict(build) !== "none") {
            reviewAll("undo");
          }
          break;
        case "r":
          reviewAndAdvance("reject");
          break;
        case "m":
          event.preventDefault();
          openComments();
          break;
        case "u":
          review("undo", current);
          break;
        case "l": {
          const story = currentStoryKey();
          if (story?.kind === "story" && closedStories.has(story.key)) {
            toggleStory(story.key);
          }
          break;
        }
        case "h": {
          const story = currentStoryKey();
          if (story?.kind === "story" && !closedStories.has(story.key)) {
            toggleStory(story.key);
          }
          break;
        }
        case "d":
          if (settings.mode === "side") {
            settings.setSideDiff(!settings.sideDiff);
          } else if (settings.mode === "diff") {
            settings.setDiffOnly(!settings.diffOnly);
          }
          break;
        case "c":
          if (
            (settings.mode === "side" && settings.sideDiff) ||
            settings.mode === "diff"
          ) {
            const index = DIFF_COLORS.findIndex(
              (option) => option.value === settings.diffColor,
            );
            const next = DIFF_COLORS[(index + 1) % DIFF_COLORS.length];
            if (next !== undefined) {
              settings.setDiffColor(next.value);
            }
          }
          break;
        case " ":
          if (settings.mode === "flip") {
            event.preventDefault();
            settings.setShowBaseline(!settings.showBaseline);
          }
          break;
        case "f":
          settings.setView(null);
          break;
        case "0":
          settings.zoom({ to: 1 });
          break;
        case "=":
        case "+":
          settings.zoom({ by: ZOOM_STEP });
          break;
        case "-":
          settings.zoom({ by: 1 / ZOOM_STEP });
          break;
        case "/":
          event.preventDefault();
          filterInput.current?.focus();
          break;
        case "?":
          setShortcutsOpen(true);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const sidebar = useSidebarWidth();
  const hasSnapshots = GROUPS.some((group) => build.counts[group.status] > 0);

  return (
    <>
      <BuildHeader
        build={build}
        owner={owner}
        repo={repo}
        canWrite={canWrite}
        links={links}
        headings={headings}
        canReview={canReview}
        onApproveAll={() => reviewAll("approve")}
        onRejectAll={() => reviewAll("reject")}
        onUndoAll={() => reviewAll("undo")}
      />
      <Banners build={build} owner={owner} repo={repo} />
      <div className="relative flex min-h-0 flex-1">
        {listOpen && (
          <button
            type="button"
            aria-label="Close snapshot list"
            className="absolute inset-0 z-20 animate-fade bg-black/20 lg:hidden"
            onClick={() => setListOpen(false)}
          />
        )}
        <aside
          style={
            sidebar.width === null
              ? undefined
              : ({ "--sidebar-width": `${sidebar.width}px` } as CSSProperties)
          }
          className={`relative flex shrink-0 flex-col border-r border-border bg-surface max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(320px,calc(100vw-48px))] max-lg:shadow-menu ${
            sidebar.width === null
              ? "w-[300px] max-xl:w-[260px]"
              : "lg:w-(--sidebar-width)"
          } ${listOpen ? "max-lg:animate-fade" : "max-lg:hidden"}`}
        >
          <div className="flex shrink-0 items-center">
            <FilterInput
              inputRef={filterInput}
              value={filter}
              onChange={setFilter}
            />
            <button
              type="button"
              aria-label="Close snapshot list"
              className={`mr-2 ${buttonClass("ghost", "icon")} lg:hidden`}
              onClick={() => setListOpen(false)}
            >
              <XIcon size={16} />
            </button>
          </div>
          {build.browsers.length > 1 && (
            <div className="shrink-0 px-2 pb-2">
              <SelectMenu
                label="Browser"
                value={activeBrowser}
                options={[
                  { value: undefined, label: "All" },
                  ...build.browsers.map((value) => ({ value, label: value })),
                ]}
                onChange={(value) => {
                  track("Browser filter", { browser: value ?? "all" });
                  setBrowser(value);
                }}
              />
            </div>
          )}
          <nav
            aria-label="Snapshots"
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          >
            {GROUPS.filter((group) => build.counts[group.status] > 0).map(
              (group) => {
                const query = groups[group.status];
                return (
                  <SnapshotGroup
                    key={group.status}
                    status={group.status}
                    label={group.label}
                    count={build.counts[group.status]}
                    open={!collapsed.has(group.status)}
                    onToggle={() => toggleGroup(group.status)}
                    entries={groupEntries(group.status)}
                    closedStories={closedStories}
                    onToggleStory={toggleStory}
                    browsers={build.browsers}
                    loading={query.status === "LoadingFirstPage"}
                    canLoadMore={query.status === "CanLoadMore"}
                    onLoadMore={() => query.loadMore(200)}
                    selectedId={snapshotId}
                    selectedStory={selectedStory}
                    linkParams={links ? linkParams : null}
                    onSelect={(row, story) => {
                      setListOpen(false);
                      setSelectedStory(story);
                      if (!links) {
                        selectId(row.id);
                      }
                    }}
                  />
                );
              },
            )}
            {!hasSnapshots && (
              <p className="px-2 py-3 text-sm text-muted">
                {build.status === "pending"
                  ? "No snapshots yet."
                  : "No snapshots."}
              </p>
            )}
          </nav>
          <hr
            aria-orientation="vertical"
            aria-label="Resize snapshot list"
            aria-valuenow={sidebar.width ?? undefined}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            title="Drag to resize, double-click to reset"
            className={`peer absolute inset-y-0 m-0 h-auto border-0 -right-[3px] z-10 w-[5px] cursor-col-resize touch-none transition-colors duration-100 hover:bg-link focus-visible:bg-link max-lg:hidden ${
              sidebar.resizing ? "bg-link" : ""
            }`}
            {...sidebar.handleProps}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute top-1/2 -right-0.5 z-10 h-4 w-[3px] -translate-y-1/2 rounded-full transition-colors duration-100 max-lg:hidden ${
              sidebar.resizing
                ? "bg-link"
                : "bg-field-border/60 peer-hover:bg-link peer-focus-visible:bg-link"
            }`}
          />
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          {snapshotId === undefined ? (
            <NoSelection
              build={build}
              waiting={firstId === undefined && build.status !== "pending"}
              onOpenList={() => setListOpen(true)}
            />
          ) : (
            <SnapshotDetail
              owner={owner}
              repo={repo}
              build={build}
              snapshotId={snapshotId as Id<"snapshots">}
              settings={settings}
              headings={headings}
              canReview={canReview}
              onApprove={() => reviewAndAdvance("approve")}
              onReject={() => reviewAndAdvance("reject")}
              commenting={commenting}
              onOpenComments={openComments}
              onCloseComments={() => setCommenting(false)}
              onComment={(body) => {
                track("Comment");
                addComment({
                  snapshotId: snapshotId as Id<"snapshots">,
                  body,
                }).catch(() => show("error", "Could not add the comment."));
              }}
              onUndo={() => review("undo", current)}
              story={current?.kind === "story" ? current.rows : undefined}
              onPrevious={selectPrevious}
              onNext={selectNext}
              navigation={
                <SnapshotNavigation
                  position={currentIndex + 1}
                  total={ordered.length}
                  onOpenList={() => setListOpen(true)}
                />
              }
            />
          )}
        </section>
      </div>
      {[...neighbours].map((id) => (
        <PrefetchSnapshot
          key={id}
          owner={owner}
          repo={repo}
          number={build.number}
          snapshotId={id}
        />
      ))}
      <Toasts toasts={toasts} dismiss={dismiss} className="bottom-16" />
    </>
  );
}

function NoSelection({
  build,
  waiting,
  onOpenList,
}: {
  build: Build;
  waiting: boolean;
  onOpenList: () => void;
}) {
  if (build.status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted">
        <span className="flex items-center gap-2">
          <Spinner size={14} />
          Waiting for screenshots
        </span>
      </div>
    );
  }
  if (waiting && build.counts.changed + build.counts.added === 0) {
    return (
      <div className="flex flex-1 flex-col items-start gap-6 overflow-y-auto p-8 max-sm:p-4">
        {build.counts.unchanged === 0 ? (
          <LeadCopy title="No snapshots.">
            {build.status === "expired"
              ? "The upload never finished, so there is nothing to compare."
              : "This build finished without any screenshots."}
          </LeadCopy>
        ) : (
          <LeadCopy title="Nothing to review.">
            {build.counts.unchanged === 1
              ? "The snapshot matches the baseline."
              : `All ${formatCount(build.counts.unchanged)} snapshots match the baseline.`}
          </LeadCopy>
        )}
        <button
          type="button"
          className={`${buttonClass()} lg:hidden`}
          onClick={onOpenList}
        >
          <SidebarSimpleIcon size={16} />
          Browse snapshots
        </button>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 bg-canvas p-4">
      <Skeleton className="aspect-[16/10] max-h-full w-full bg-surface" />
    </div>
  );
}

function SnapshotNavigation({
  position,
  total,
  onOpenList,
}: {
  position: number;
  total: number;
  onOpenList: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={`${buttonClass("secondary", "sm")} lg:hidden`}
        onClick={onOpenList}
      >
        <SidebarSimpleIcon size={14} />
        <span className="tabular-nums">
          {position > 0 ? `${position} of ${total}` : total}
        </span>
      </button>
      <span className="px-1 text-xs text-muted tabular-nums max-lg:hidden">
        {position > 0 ? `${position} of ${total}` : ""}
      </span>
    </div>
  );
}

function FilterInput({
  inputRef,
  value,
  onChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 p-2">
      <Tooltip label="Filter, press /" wrapperClassName="flex">
        <label className="relative flex w-full items-center">
          <MagnifyingGlassIcon
            size={14}
            className="pointer-events-none absolute left-2.5 text-subtle"
          />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.blur();
              }
            }}
            placeholder="Filter snapshots"
            aria-label="Filter snapshots"
            className="h-8 w-full rounded-md bg-surface pr-8 pl-8 text-sm shadow-[inset_0_0_0_1px_var(--color-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle hover:shadow-[inset_0_0_0_1px_var(--color-field-border)] focus:shadow-field-focus [&::-webkit-search-cancel-button]:hidden"
          />
          {value !== "" && (
            <button
              type="button"
              aria-label="Clear filter"
              className={`absolute right-1 ${buttonClass("ghost", "icon-sm")}`}
              onClick={() => onChange("")}
            >
              <XIcon size={12} />
            </button>
          )}
        </label>
      </Tooltip>
    </div>
  );
}
