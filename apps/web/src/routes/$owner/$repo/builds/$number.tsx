import {
  CaretDownIcon,
  CaretUpIcon,
  KeyboardIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  type CSSProperties,
  createContext,
  lazy,
  type RefObject,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppHeader } from "../../../../components/AppHeader";
import { Banners, BuildHeader } from "../../../../components/build/BuildHeader";
import {
  BuildDeleted,
  BuildNotFound,
} from "../../../../components/build/BuildNotFound";
import {
  type ReviewAction,
  useBuildData,
} from "../../../../components/build/buildData";
import { SnapshotDetail } from "../../../../components/build/SnapshotDetail";
import { SnapshotGroup } from "../../../../components/build/SnapshotGroup";
import type { Build, SnapshotRow } from "../../../../components/build/types";
import { RequireAuth } from "../../../../components/RequireAuth";
import { ShortcutsDialog } from "../../../../components/ShortcutsDialog";
import { Toasts, useToasts } from "../../../../components/Toast";
import {
  buttonClass,
  type DiffStatus,
  Kbd,
  LeadCopy,
  Skeleton,
  Spinner,
} from "../../../../components/ui";
import { MODES, useViewerSettings } from "../../../../components/Viewer";
import { track } from "../../../../lib/analytics";
import { ZOOM_STEP } from "../../../../lib/canvasView";
import { errorCode } from "../../../../lib/errorCode";
import { formatCount } from "../../../../lib/format";
import { isLab } from "../../../../lib/lab";
import { prefetchBuild } from "../../../../lib/prefetch";
import { useImageUrl } from "../../../../lib/useImageUrl";
import { useProjectAccess } from "../../../../lib/useProjectAccess";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarWidth,
} from "../../../../lib/useSidebarWidth";

export const Route = createFileRoute("/$owner/$repo/builds/$number")({
  loader: ({ context, params }) =>
    isLab(params.owner) ? undefined : prefetchBuild(context.convex, params),
  component: BuildRoute,
});

const LabBuild = import.meta.env.DEV
  ? lazy(() => import("../../../../components/build/LabBuild"))
  : null;

const GROUPS: { status: DiffStatus; label: string }[] = [
  { status: "changed", label: "Changed" },
  { status: "added", label: "Added" },
  { status: "removed", label: "Removed" },
  { status: "failed", label: "Failed" },
  { status: "unchanged", label: "Unchanged" },
];

const PREFETCH_PENDING = 3;

const ACTION_VERBS: Record<ReviewAction, string> = {
  approve: "approve",
  reject: "reject",
  undo: "undo the review of",
};

const ShortcutsContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

function BuildRoute() {
  const { owner, repo, number } = Route.useParams();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const lab = isLab(owner) && LabBuild !== null;
  const page = (
    <ShortcutsContext.Provider
      value={{ open: shortcutsOpen, setOpen: setShortcutsOpen }}
    >
      <div className="flex h-dvh flex-col">
        <AppHeader
          owner={owner}
          repo={repo}
          actions={
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className={buttonClass("ghost", "icon")}
              onClick={() => setShortcutsOpen(true)}
            >
              <KeyboardIcon size={18} />
            </button>
          }
        />
        {lab ? (
          <Suspense fallback={<BuildSkeleton />}>
            <LabBuild number={Number(number)}>
              {(build) => (
                <BuildPage build={build} canWrite owner={owner} repo={repo} />
              )}
            </LabBuild>
          </Suspense>
        ) : (
          <BuildAccess owner={owner} repo={repo} number={Number(number)} />
        )}
      </div>
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </ShortcutsContext.Provider>
  );
  return lab ? (
    page
  ) : (
    <RequireAuth redirectTo={`/${owner}/${repo}/builds/${number}`}>
      {page}
    </RequireAuth>
  );
}

function BuildAccess({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const { snapshotId } = useParams({ strict: false });
  const result = useProjectAccess(owner, repo);
  const valid = Number.isInteger(number);
  const build = useQuery(
    api.builds.get,
    valid ? { owner, name: repo, number } : "skip",
  );
  const deleted = useQuery(
    api.builds.deleted,
    valid && build === null ? { owner, name: repo, number } : "skip",
  );
  const prefetch = valid && snapshotId !== undefined && (
    <PrefetchSnapshot
      owner={owner}
      repo={repo}
      number={number}
      snapshotId={snapshotId as Id<"snapshots">}
    />
  );
  if (result.state === "loading" || (build === undefined && valid)) {
    return (
      <>
        {prefetch}
        <BuildSkeleton />
      </>
    );
  }
  if (result.state === "not_found") {
    return <BuildNotFound title="Project not found." />;
  }
  if (!build) {
    if (deleted === undefined && valid) {
      return <BuildSkeleton />;
    }
    return deleted ? (
      <BuildDeleted
        owner={owner}
        repo={repo}
        number={number}
        deletion={deleted.deletion}
      />
    ) : (
      <BuildNotFound title="Build not found." />
    );
  }
  return (
    <BuildPage
      build={build}
      canWrite={result.access.canWrite}
      owner={owner}
      repo={repo}
    />
  );
}

function BuildSkeleton() {
  return (
    <>
      <div className="flex h-[76px] shrink-0 flex-col justify-center gap-2.5 border-b border-border bg-surface px-4">
        <Skeleton className="h-4 w-80 rounded-xs" />
        <Skeleton className="h-3 w-120 max-w-full rounded-xs" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[300px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 max-lg:hidden">
          <Skeleton className="mb-2 h-8" />
          {Array.from({ length: 8 }, (_, index) => `row-${index}`).map(
            (key) => (
              <Skeleton key={key} className="h-8 rounded-sm opacity-60" />
            ),
          )}
        </div>
        <div className="flex-1 bg-canvas p-4">
          <Skeleton className="aspect-[16/10] max-h-full w-full bg-surface" />
        </div>
      </div>
    </>
  );
}

function PrefetchSnapshot({
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

function BuildPage({
  build,
  canWrite,
  owner,
  repo,
}: {
  build: Build;
  canWrite: boolean;
  owner: string;
  repo: string;
}) {
  const { snapshotId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<DiffStatus>>(
    () => new Set(["unchanged"]),
  );
  const [rejecting, setRejecting] = useState(false);
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } =
    useContext(ShortcutsContext);
  const [listOpen, setListOpen] = useState(false);
  const filterInput = useRef<HTMLInputElement>(null);
  const settings = useViewerSettings();
  const { toasts, show, dismiss } = useToasts();
  const data = useBuildData();
  const applyReview = data.useApplyReview();
  const groups = data.useSnapshotGroups(
    build.buildId,
    build.counts,
    !collapsed.has("unchanged"),
  );
  const canReview =
    canWrite && build.status === "finalized" && !build.superseded;

  const needle = filter.trim().toLowerCase();
  const visible = (rows: SnapshotRow[]) =>
    needle === ""
      ? rows
      : rows.filter((row) => row.name.toLowerCase().includes(needle));
  const ordered = GROUPS.flatMap((group) =>
    collapsed.has(group.status) ? [] : visible(groups[group.status].results),
  );
  const currentIndex = ordered.findIndex((row) => row.id === snapshotId);
  const current = currentIndex === -1 ? undefined : ordered[currentIndex];
  const linkParams = { owner, repo, number: String(build.number) };

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

  const select = (row: SnapshotRow | undefined) => {
    if (row !== undefined) {
      settings.setShowBaseline(false);
      settings.setView(null);
      void navigate({
        to: "/$owner/$repo/builds/$number/snapshots/$snapshotId",
        params: { ...linkParams, snapshotId: row.id },
      });
    }
  };
  const selectNext = () => select(ordered[currentIndex + 1] ?? ordered[0]);
  const selectPrevious = () =>
    select(ordered[currentIndex - 1] ?? ordered[ordered.length - 1]);

  const firstId = ordered.find((row) => row.diffStatus !== "unchanged")?.id;
  useEffect(() => {
    if (snapshotId === undefined && firstId !== undefined) {
      void navigate({
        to: "/$owner/$repo/builds/$number/snapshots/$snapshotId",
        params: { ...linkParams, snapshotId: firstId },
        replace: true,
      });
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

  const review = (
    action: ReviewAction,
    row: SnapshotRow | undefined,
    comment?: string,
  ) => {
    if (!canReview || row === undefined || row.reviewState === "none") {
      return;
    }
    track("Review", { action });
    applyReview({
      buildId: build.buildId,
      snapshotIds: [row.id],
      action,
      comment,
    }).catch((error: unknown) => {
      const reason =
        errorCode(error) === "build_not_reviewable"
          ? " This build can no longer be reviewed."
          : " Your change was undone.";
      show("error", `Could not ${ACTION_VERBS[action]} ${row.name}.${reason}`);
    });
  };

  const approveAndAdvance = () => {
    if (current === undefined || current.reviewState === "none") {
      return;
    }
    review("approve", current);
    select(nextPending);
  };

  const pendingAhead = [
    ...ordered.slice(currentIndex + 1),
    ...ordered.slice(0, currentIndex),
  ]
    .filter((row) => row.reviewState === "pending")
    .slice(0, PREFETCH_PENDING);
  const nextPending = pendingAhead[0];
  const neighbours = new Set(
    [
      ordered[currentIndex + 1] ?? ordered[0],
      ordered[currentIndex - 1] ?? ordered[ordered.length - 1],
      ...pendingAhead,
    ].flatMap((row) =>
      row === undefined || row.id === snapshotId ? [] : [row.id],
    ),
  );

  const reviewAll = (action: "approve" | "reject") => {
    if (!canReview) {
      return;
    }
    track("Review all", { action });
    applyReview({ buildId: build.buildId, snapshotIds: "all", action }).catch(
      () => show("error", `Could not ${action} all snapshots.`),
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest(
          "input:not([type=range]), textarea, select, [contenteditable]",
        ) ||
        shortcutsOpen ||
        rejecting
      ) {
        return;
      }
      const mode = MODES.find((item) => item.key === event.key);
      if (mode !== undefined) {
        settings.setMode(mode.value);
        return;
      }
      switch (event.key) {
        case "j":
          selectNext();
          break;
        case "k":
          selectPrevious();
          break;
        case "a":
          approveAndAdvance();
          break;
        case "A":
          reviewAll("approve");
          break;
        case "r":
          if (canReview && current && current.reviewState !== "none") {
            event.preventDefault();
            setRejecting(true);
          }
          break;
        case "u":
          review("undo", current);
          break;
        case "d":
          if (settings.mode === "side") {
            settings.setSideDiff(!settings.sideDiff);
          } else if (settings.mode === "diff") {
            settings.setDiffOnly(!settings.diffOnly);
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
        canReview={canReview}
        onApproveAll={() => reviewAll("approve")}
        onRejectAll={() => reviewAll("reject")}
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
          <FilterInput
            inputRef={filterInput}
            value={filter}
            onChange={setFilter}
          />
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
                    rows={visible(query.results)}
                    loading={query.status === "LoadingFirstPage"}
                    canLoadMore={query.status === "CanLoadMore"}
                    onLoadMore={() => query.loadMore(200)}
                    selectedId={snapshotId}
                    linkParams={linkParams}
                    onSelect={() => setListOpen(false)}
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
            className={`absolute inset-y-0 m-0 h-auto border-0 -right-[3px] z-10 w-[5px] cursor-col-resize touch-none transition-colors duration-100 hover:bg-link focus-visible:bg-link max-lg:hidden ${
              sidebar.resizing ? "bg-link" : ""
            }`}
            {...sidebar.handleProps}
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
              canWrite={canWrite}
              canReview={canReview}
              rejecting={rejecting}
              onStartReject={() => setRejecting(true)}
              onCancelReject={() => setRejecting(false)}
              onApprove={approveAndAdvance}
              onReject={(comment) => {
                setRejecting(false);
                review("reject", current, comment);
              }}
              onUndo={() => review("undo", current)}
              navigation={
                <SnapshotNavigation
                  position={currentIndex + 1}
                  total={ordered.length}
                  onPrevious={selectPrevious}
                  onNext={selectNext}
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
      <Toasts toasts={toasts} dismiss={dismiss} />
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
  onPrevious,
  onNext,
  onOpenList,
}: {
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
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
      <button
        type="button"
        aria-label="Previous snapshot"
        title="Previous (k)"
        className={buttonClass("ghost", "icon-sm")}
        onClick={onPrevious}
      >
        <CaretUpIcon size={14} />
      </button>
      <button
        type="button"
        aria-label="Next snapshot"
        title="Next (j)"
        className={buttonClass("ghost", "icon-sm")}
        onClick={onNext}
      >
        <CaretDownIcon size={14} />
      </button>
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
    <div className="shrink-0 p-2">
      <label className="relative flex items-center">
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
        {value === "" ? (
          <span className="pointer-events-none absolute right-1.5">
            <Kbd>/</Kbd>
          </span>
        ) : (
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
    </div>
  );
}
