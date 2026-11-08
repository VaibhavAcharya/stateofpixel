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
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "uiofcraft";
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
import { type DiffStatus, LeadCopy, Skeleton, Spinner, Tooltip } from "../ui";
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
  storyName,
} from "./stories";
import type { Build, SnapshotRow } from "./types";

type GroupKey = DiffStatus | "unstable";

type Group = { key: GroupKey; status: DiffStatus; label: string };

const GROUPS: Group[] = [
  { key: "changed", status: "changed", label: "Changed" },
  { key: "added", status: "added", label: "Added" },
  { key: "removed", status: "removed", label: "Removed" },
  { key: "failed", status: "failed", label: "Failed" },
  { key: "unstable", status: "changed", label: "Unstable" },
  { key: "unchanged", status: "unchanged", label: "Unchanged" },
];

const REVIEW_STATUSES = ["changed", "added", "removed", "failed"] as const;

function isUnstableChange(row: SnapshotRow): boolean {
  return row.unstable && row.diffStatus === "changed";
}

const PREFETCH_PENDING = 3;
const SNAPSHOTS_PER_CALL = 100;
const SEARCH_DELAY_MS = 200;

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
  const [collapsed, setCollapsed] = useState<Set<GroupKey>>(
    () => new Set(["unchanged", "unstable"]),
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
  const snapshotList = useRef<HTMLElement>(null);
  const settings = useViewerSettings();
  const { toasts, show, dismiss } = useToasts();
  const data = useBuildData();
  const linkParams = { owner, repo, number: String(build.number) };
  const { snapshotId, select: selectId } = data.useSelection(linkParams);
  const applyReview = data.useApplyReview();
  const addComment = data.useAddComment();
  const markUnstable = data.useMarkUnstable();
  const needle = filter.trim().toLowerCase();
  const activeBrowser =
    browser !== undefined && build.browsers.includes(browser)
      ? browser
      : undefined;
  const [search, setSearch] = useState(needle);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(needle), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [needle]);
  const groups = data.useSnapshotGroups(
    build.buildId,
    build.counts,
    !collapsed.has("unchanged"),
    { search, browser: activeBrowser },
  );
  const canReview =
    canWrite && build.status === "finalized" && !build.superseded;

  const visible = (rows: SnapshotRow[]) =>
    rows.filter(
      (row) =>
        (needle === "" || row.name.toLowerCase().includes(needle)) &&
        (activeBrowser === undefined || row.browser === activeBrowser),
    );
  const groupRows = (group: Group) =>
    visible(groups[group.status].results).filter(
      (row) => isUnstableChange(row) === (group.key === "unstable"),
    );
  const unstableCount = groups.changed.results.filter(isUnstableChange).length;
  const groupCount = (group: Group) =>
    group.key === "unstable"
      ? unstableCount
      : group.key === "changed"
        ? build.counts.changed - unstableCount
        : build.counts[group.status];
  const groupEntries = (group: Group) =>
    someBrowsersFirst(
      groupStories(groupRows(group)),
      activeBrowser === undefined ? build.browsers : [],
    );
  const groupItems = (group: Group) =>
    groupEntries(group).map((entry) => entry.item);
  const ordered = GROUPS.flatMap((group) =>
    collapsed.has(group.key)
      ? []
      : groupItems(group).flatMap((item): SnapshotItem[] =>
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
    return GROUPS.flatMap(groupItems).find(
      (item) =>
        item.kind === "story" &&
        item.rows.some((storyRow) => storyRow.id === snapshotId),
    );
  };

  const toggleGroup = (key: GroupKey) =>
    setCollapsed((value) => {
      const next = new Set(value);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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
  const reviewGroupsLoaded = REVIEW_STATUSES.every(
    (status) =>
      build.counts[status] === 0 ||
      groups[status].status !== "LoadingFirstPage",
  );
  useEffect(() => {
    if (
      snapshotId === undefined &&
      firstId !== undefined &&
      reviewGroupsLoaded
    ) {
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

  const markCurrentUnstable = () => {
    if (!canReview || current === undefined) {
      return;
    }
    const name =
      current.kind === "row" ? storyName(current.row.name) : current.name;
    const pending = itemRows(current).filter(
      (row) => row.diffStatus === "changed" && row.reviewState === "pending",
    );
    track("Mark unstable");
    markUnstable({ buildId: build.buildId, name })
      .then(() =>
        pending.length === 0
          ? null
          : applyReview({
              buildId: build.buildId,
              snapshotIds: pending.map((row) => row.id),
              action: "approve",
            }),
      )
      .catch(() => show("error", `Could not mark ${name} unstable.`));
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
          "input:not([type=range]), textarea, select, [contenteditable], dialog, [role=dialog]",
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
          className={`relative flex shrink-0 flex-col border-r border-border bg-sidebar max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(320px,calc(100vw-48px))] max-lg:shadow-menu ${
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
            <Button
              variant="ghost"
              size="icon"
              className="mr-2   lg:hidden"
              aria-label="Close snapshot list"
              onClick={() => setListOpen(false)}
            >
              <XIcon size={16} />
            </Button>
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
            ref={snapshotList}
            aria-label="Snapshots"
            className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          >
            <SelectionIndicator list={snapshotList} />
            {GROUPS.filter((group) => groupCount(group) > 0).map((group) => {
              const query = groups[group.status];
              return (
                <SnapshotGroup
                  key={group.key}
                  status={group.status}
                  label={group.label}
                  count={groupCount(group)}
                  open={!collapsed.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                  entries={groupEntries(group)}
                  closedStories={closedStories}
                  onToggleStory={toggleStory}
                  browsers={build.browsers}
                  loading={query.status === "LoadingFirstPage"}
                  canLoadMore={
                    group.key !== "unstable" && query.status === "CanLoadMore"
                  }
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
            })}
            {!hasSnapshots && (
              <p className="px-2 py-3 text-sm text-muted-foreground">
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
                : "bg-input/60 peer-hover:bg-link peer-focus-visible:bg-link"
            }`}
          />
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
          {snapshotId === undefined ? (
            <NoSelection
              build={build}
              waiting={firstId === undefined && build.status !== "pending"}
              unstableCount={unstableCount}
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
              onMarkUnstable={markCurrentUnstable}
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
  unstableCount,
  onOpenList,
}: {
  build: Build;
  waiting: boolean;
  unstableCount: number;
  onOpenList: () => void;
}) {
  if (build.status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Spinner size={14} />
          Waiting for screenshots
        </span>
      </div>
    );
  }
  if (
    waiting &&
    build.counts.changed - unstableCount + build.counts.added === 0
  ) {
    return (
      <div className="flex flex-1 flex-col items-start gap-6 overflow-y-auto p-8 max-sm:p-4">
        {unstableCount > 0 ? (
          <LeadCopy title="Nothing to review." size="app">
            {unstableCount === 1
              ? "The only change is in a snapshot marked unstable, so it is approved automatically."
              : `All ${formatCount(unstableCount)} changes are in snapshots marked unstable, so they are approved automatically.`}
          </LeadCopy>
        ) : build.counts.unchanged === 0 ? (
          <LeadCopy title="No snapshots." size="app">
            {build.status === "expired"
              ? "The upload never finished, so there is nothing to compare."
              : "This build finished without any screenshots."}
          </LeadCopy>
        ) : (
          <LeadCopy title="Nothing to review." size="app">
            {build.counts.unchanged === 1
              ? "The snapshot matches the baseline."
              : `All ${formatCount(build.counts.unchanged)} snapshots match the baseline.`}
          </LeadCopy>
        )}
        <Button variant="outline" className="lg:hidden" onClick={onOpenList}>
          <SidebarSimpleIcon size={16} />
          Browse snapshots
        </Button>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 bg-canvas p-4">
      <Skeleton className="aspect-[16/10] max-h-full w-full bg-card" />
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
      <Button
        variant="outline"
        size="sm"
        className="lg:hidden"
        onClick={onOpenList}
      >
        <SidebarSimpleIcon size={14} />
        <span className="tabular-nums">
          {position > 0 ? `${position} of ${total}` : total}
        </span>
      </Button>
      <span className="px-1 text-xs text-muted-foreground tabular-nums max-lg:hidden">
        {position > 0 ? `${position} of ${total}` : ""}
      </span>
    </div>
  );
}

function SelectionIndicator({ list }: { list: RefObject<HTMLElement | null> }) {
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const element = list.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const row = element.querySelector<HTMLElement>("[aria-current]");
      if (!row) {
        setBar(null);
        return;
      }
      const top =
        row.getBoundingClientRect().top -
        element.getBoundingClientRect().top +
        element.scrollTop;
      setBar((current) =>
        current?.top === top && current.height === row.offsetHeight
          ? current
          : { top, height: row.offsetHeight },
      );
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-current"],
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [list]);
  if (bar === null) {
    return null;
  }
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-2 z-10 w-0.5 rounded-full bg-primary transition-[transform,height] duration-200 ease-in-out motion-reduce:transition-none"
      style={{
        height: bar.height - 12,
        transform: `translateY(${bar.top + 6}px)`,
        top: 0,
      }}
    />
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
      <Tooltip label="Filter, press /" wrapperClassName="flex w-full">
        <InputGroup>
          <InputGroupInput
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
            className="[&_input::-webkit-search-cancel-button]:hidden"
          />
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          {value !== "" && (
            <InputGroupAddon align="inline-end">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear filter"
                onClick={() => onChange("")}
              >
                <XIcon />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
      </Tooltip>
    </div>
  );
}
