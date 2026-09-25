import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  ClockIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  InfoIcon,
  KeyboardIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { conclude } from "@stateofpixel/backend/conclude";
import type { Id } from "@stateofpixel/backend/dataModel";
import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { usePaginatedQuery, useQuery } from "convex-helpers/react/cache/hooks";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppHeader } from "../../../../components/AppHeader";
import { RequireAuth } from "../../../../components/RequireAuth";
import { ShortcutsDialog } from "../../../../components/ShortcutsDialog";
import { Toasts, useToasts } from "../../../../components/Toast";
import {
  BuildStatePill,
  buttonClass,
  DIFF_ICONS,
  type DiffStatus,
  EmptyState,
  Kbd,
  LeadCopy,
  REVIEW_ICONS,
  RelativeTime,
  type ReviewState,
  Skeleton,
  SnapshotName,
  Spinner,
  SupersededPill,
  TONE_TEXT,
} from "../../../../components/ui";
import {
  MODES,
  useViewerSettings,
  Viewer,
  type ViewerSettings,
} from "../../../../components/Viewer";
import { formatCount, formatPercent, shortSha } from "../../../../lib/format";
import { prefetchBuild } from "../../../../lib/prefetch";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

export const Route = createFileRoute("/$owner/$repo/builds/$number")({
  loader: ({ context, params }) => prefetchBuild(context.convex, params),
  component: BuildRoute,
});

type Build = NonNullable<FunctionReturnType<typeof api.builds.get>>;
type SnapshotRow = FunctionReturnType<
  typeof api.snapshots.list
>["page"][number];
type Snapshot = NonNullable<FunctionReturnType<typeof api.snapshots.get>>;
type ReviewAction = "approve" | "reject" | "undo";

const GROUPS: { status: DiffStatus; label: string }[] = [
  { status: "changed", label: "Changed" },
  { status: "added", label: "Added" },
  { status: "removed", label: "Removed" },
  { status: "failed", label: "Failed" },
  { status: "unchanged", label: "Unchanged" },
];

const NEXT_STATE: Record<ReviewAction, Exclude<ReviewState, "none">> = {
  approve: "approved",
  reject: "rejected",
  undo: "pending",
};

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
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}/builds/${number}`}>
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
          <BuildAccess owner={owner} repo={repo} number={Number(number)} />
        </div>
        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </ShortcutsContext.Provider>
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
    return <NotFound title="Project not found." />;
  }
  if (!build) {
    return <NotFound title="Build not found." />;
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

function NotFound({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 max-sm:px-4">
      <EmptyState title={title}>
        It may not exist, or you do not have access to the repository on GitHub.
      </EmptyState>
    </div>
  );
}

function useSnapshotGroups(
  buildId: Id<"builds">,
  counts: Build["counts"],
  unchangedOpen: boolean,
) {
  const options = { initialNumItems: 200 };
  const args = (diffStatus: DiffStatus, enabled: boolean) =>
    enabled ? { buildId, diffStatus } : ("skip" as const);
  return {
    changed: usePaginatedQuery(
      api.snapshots.list,
      args("changed", counts.changed > 0),
      options,
    ),
    added: usePaginatedQuery(
      api.snapshots.list,
      args("added", counts.added > 0),
      options,
    ),
    removed: usePaginatedQuery(
      api.snapshots.list,
      args("removed", counts.removed > 0),
      options,
    ),
    failed: usePaginatedQuery(
      api.snapshots.list,
      args("failed", counts.failed > 0),
      options,
    ),
    unchanged: usePaginatedQuery(
      api.snapshots.list,
      args("unchanged", unchangedOpen && counts.unchanged > 0),
      options,
    ),
  };
}

function useApplyReview() {
  return useMutation(api.reviews.apply).withOptimisticUpdate((store, args) => {
    const next = NEXT_STATE[args.action];
    const ids =
      args.snapshotIds === "all" ? null : new Set<string>(args.snapshotIds);
    const previous = new Map<string, Exclude<ReviewState, "none">>();
    const review = <Row extends { id: string; reviewState: ReviewState }>(
      row: Row,
    ): Row => {
      const current = row.reviewState;
      if (
        current === "none" ||
        current === next ||
        (ids === null ? current !== "pending" : !ids.has(row.id))
      ) {
        return row;
      }
      previous.set(row.id, current);
      return { ...row, reviewState: next };
    };

    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.list,
    )) {
      if (value !== undefined && queryArgs.buildId === args.buildId) {
        store.setQuery(api.snapshots.list, queryArgs, {
          ...value,
          page: value.page.map(review),
        });
      }
    }
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.get,
    )) {
      if (value?.buildId === args.buildId) {
        store.setQuery(api.snapshots.get, queryArgs, review(value));
      }
    }

    const reviewCounts = (counts: Build["counts"]) => {
      const result = { ...counts };
      if (ids === null) {
        result[next] += result.pending;
        result.pending = 0;
      } else {
        for (const state of previous.values()) {
          result[state]--;
          result[next]++;
        }
      }
      return result;
    };
    const updated = new Map<string, number>();
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.builds.get,
    )) {
      if (value?.buildId === args.buildId) {
        const counts = reviewCounts(value.counts);
        store.setQuery(api.builds.get, queryArgs, {
          ...value,
          counts,
          conclusion: conclude(counts),
        });
        updated.set(`${queryArgs.owner}/${queryArgs.name}`, value.number);
      }
    }
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.builds.list,
    )) {
      const number = updated.get(`${queryArgs.owner}/${queryArgs.name}`);
      if (value !== undefined && number !== undefined) {
        store.setQuery(api.builds.list, queryArgs, {
          ...value,
          page: value.page.map((row) => {
            if (row.number !== number) {
              return row;
            }
            const counts = reviewCounts(row.counts);
            return { ...row, counts, conclusion: conclude(counts) };
          }),
        });
      }
    }
  });
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
  const snapshot = useQuery(api.snapshots.get, {
    owner,
    name: repo,
    number,
    snapshotId,
  });
  useEffect(() => {
    for (const image of [
      snapshot?.image,
      snapshot?.baselineImage,
      snapshot?.diffImage,
    ]) {
      if (image) {
        new Image().src = image.url;
      }
    }
  }, [snapshot]);
  return null;
}

function errorCode(error: unknown): string | null {
  return error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data
    ? String(error.data.code)
    : null;
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
  const applyReview = useApplyReview();
  const groups = useSnapshotGroups(
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

  const nextPending = [
    ...ordered.slice(currentIndex + 1),
    ...ordered.slice(0, currentIndex),
  ].find((row) => row.reviewState === "pending");
  const neighbours = new Set(
    [
      ordered[currentIndex + 1] ?? ordered[0],
      ordered[currentIndex - 1] ?? ordered[ordered.length - 1],
      nextPending,
    ].flatMap((row) =>
      row === undefined || row.id === snapshotId ? [] : [row.id],
    ),
  );

  const reviewAll = (action: "approve" | "reject") => {
    if (!canReview) {
      return;
    }
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
          }
          break;
        case " ":
          if (settings.mode === "flip") {
            event.preventDefault();
            settings.setShowBaseline(!settings.showBaseline);
          }
          break;
        case "f":
          settings.setZoom("fit");
          break;
        case "0":
          settings.setZoom("100");
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
          className={`flex w-[300px] shrink-0 flex-col border-r border-border bg-surface max-xl:w-[260px] max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:w-[min(320px,calc(100vw-48px))] max-lg:shadow-menu ${
            listOpen ? "max-lg:animate-fade" : "max-lg:hidden"
          }`}
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
    <div className="flex-1 bg-canvas p-4">
      <Skeleton className="aspect-[16/10] w-full bg-surface" />
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

function MetaItem({
  icon: IconComponent,
  label,
  children,
}: {
  icon: typeof GitBranchIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={label}>
      <IconComponent size={14} className="shrink-0 text-subtle" />
      {children}
    </span>
  );
}

function BuildHeader({
  build,
  owner,
  repo,
  canWrite,
  canReview,
  onApproveAll,
  onRejectAll,
}: {
  build: Build;
  owner: string;
  repo: string;
  canWrite: boolean;
  canReview: boolean;
  onApproveAll: () => void;
  onRejectAll: () => void;
}) {
  const github = `https://github.com/${owner}/${repo}`;
  const nothingPending = !canReview || build.counts.pending === 0;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold tracking-[-0.01em]">
            <span className="shrink-0 text-muted tabular-nums">
              #{build.number}
            </span>
            <span className="truncate">
              {build.commitMessage || "No commit message"}
            </span>
          </h1>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={build.shards}
          />
          {build.superseded && <SupersededPill />}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <MetaItem icon={GitBranchIcon} label="Branch">
            <Link
              to="/$owner/$repo"
              params={{ owner, repo }}
              search={{ branch: build.branch }}
              className="mono truncate text-text hover:text-link"
            >
              {build.branch}
            </Link>
          </MetaItem>
          <MetaItem icon={GitCommitIcon} label="Commit">
            <a
              href={`${github}/commit/${build.commitSha}`}
              className="mono hover:text-link"
            >
              {shortSha(build.commitSha)}
            </a>
          </MetaItem>
          {build.prNumber !== null && (
            <MetaItem icon={GitPullRequestIcon} label="Pull request">
              <a
                href={`${github}/pull/${build.prNumber}`}
                className="tabular-nums hover:text-link"
              >
                #{build.prNumber}
              </a>
            </MetaItem>
          )}
          <MetaItem icon={ArrowsLeftRightIcon} label="Baseline">
            {build.baseline === null ? (
              "First build, no baseline"
            ) : (
              <span>
                vs{" "}
                <Link
                  to="/$owner/$repo/builds/$number"
                  params={{
                    owner,
                    repo,
                    number: String(build.baseline.number),
                  }}
                  className="text-text tabular-nums hover:text-link"
                >
                  #{build.baseline.number}
                </Link>{" "}
                on <span className="mono">{build.baseline.branch}</span>
              </span>
            )}
          </MetaItem>
          <MetaItem icon={ClockIcon} label="Created">
            <RelativeTime timestamp={build.createdAt} />
          </MetaItem>
        </div>
      </div>
      <div className="flex items-center gap-2 empty:hidden max-sm:w-full">
        {build.status !== "finalized" ? null : canWrite ? (
          <>
            <button
              type="button"
              className={`${buttonClass("danger")} max-sm:flex-1`}
              disabled={nothingPending}
              onClick={onRejectAll}
            >
              Reject build
            </button>
            <button
              type="button"
              className={`${buttonClass("primary")} max-sm:flex-1`}
              disabled={nothingPending}
              title="Approve all pending (shift+a)"
              onClick={onApproveAll}
            >
              Approve all
              {build.counts.pending > 0 && (
                <span className="tabular-nums opacity-60">
                  {formatCount(build.counts.pending)}
                </span>
              )}
            </button>
          </>
        ) : (
          <span className="text-xs text-muted">
            You need write access on GitHub to review
          </span>
        )}
      </div>
    </header>
  );
}

function Banners({
  build,
  owner,
  repo,
}: {
  build: Build;
  owner: string;
  repo: string;
}) {
  const banners: {
    key: string;
    tone: string;
    icon: ReactNode;
    content: ReactNode;
  }[] = [];
  if (build.supersededBy !== null) {
    banners.push({
      key: "superseded",
      tone: "bg-unchanged-bg",
      icon: <InfoIcon size={16} className="text-unchanged" />,
      content: (
        <>
          A newer build exists for this PR.{" "}
          <Link
            to="/$owner/$repo/builds/$number"
            params={{ owner, repo, number: String(build.supersededBy) }}
            className="font-medium text-link"
          >
            Open #{build.supersededBy}
          </Link>
        </>
      ),
    });
  }
  if (build.mergedPr !== null) {
    const { mergedPr } = build;
    banners.push({
      key: "merged-pr",
      tone: "bg-unchanged-bg",
      icon: <GitPullRequestIcon size={16} className="text-unchanged" />,
      content: (
        <>
          From PR{" "}
          <a
            href={`https://github.com/${owner}/${repo}/pull/${mergedPr.number}`}
            className="font-medium text-link"
          >
            #{mergedPr.number}
          </a>
          {mergedPr.lastBuildNumber !== null && (
            <>
              . Its last build is{" "}
              <Link
                to="/$owner/$repo/builds/$number"
                params={{
                  owner,
                  repo,
                  number: String(mergedPr.lastBuildNumber),
                }}
                className="font-medium text-link"
              >
                #{mergedPr.lastBuildNumber}
              </Link>
            </>
          )}
          .
        </>
      ),
    });
  }
  if (build.status === "pending") {
    banners.push({
      key: "pending",
      tone: "bg-added-bg",
      icon: <Spinner size={16} className="text-added" />,
      content:
        build.shards.total === null || build.shards.total === 1
          ? "Waiting for screenshots. This page updates by itself."
          : `Waiting for screenshots, ${build.shards.done} of ${build.shards.total} shards done. This page updates by itself.`,
    });
  }
  if (build.status === "expired") {
    banners.push({
      key: "expired",
      tone: "bg-unchanged-bg",
      icon: <ClockIcon size={16} className="text-unchanged" />,
      content: "This build never finished.",
    });
  }
  if (build.status === "error") {
    banners.push({
      key: "error",
      tone: "bg-failed-bg",
      icon: <WarningIcon size={16} className="text-failed" />,
      content: build.ciRunUrl ? (
        <>
          Upload failed.{" "}
          <a href={build.ciRunUrl} className="font-medium text-link">
            See CI logs
          </a>
        </>
      ) : (
        "Upload failed, see CI logs."
      ),
    });
  }
  if (banners.length === 0) {
    return null;
  }
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-4 py-2">
      {banners.map((banner) => (
        <p
          key={banner.key}
          className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm ${banner.tone}`}
        >
          <span className="shrink-0">{banner.icon}</span>
          <span>{banner.content}</span>
        </p>
      ))}
    </div>
  );
}

function SnapshotGroup({
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

function SnapshotDetail({
  owner,
  repo,
  build,
  snapshotId,
  settings,
  canWrite,
  canReview,
  rejecting,
  onStartReject,
  onCancelReject,
  onApprove,
  onReject,
  onUndo,
  navigation,
}: {
  owner: string;
  repo: string;
  build: Build;
  snapshotId: Id<"snapshots">;
  settings: ViewerSettings;
  canWrite: boolean;
  canReview: boolean;
  rejecting: boolean;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: (comment: string) => void;
  onUndo: () => void;
  navigation: ReactNode;
}) {
  const snapshot = useQuery(api.snapshots.get, {
    owner,
    name: repo,
    number: build.number,
    snapshotId,
  });
  if (snapshot === undefined) {
    return (
      <>
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-3.5 w-56 rounded-xs" />
        </div>
        <div className="flex-1 bg-canvas p-4">
          <Skeleton className="aspect-[16/10] w-full bg-surface" />
        </div>
      </>
    );
  }
  if (snapshot === null) {
    return <NotFound title="Snapshot not found." />;
  }
  const reviewable = canReview && snapshot.reviewState !== "none";

  return (
    <>
      <Viewer
        snapshot={snapshot}
        settings={settings}
        baselineLabel={
          build.baseline === null
            ? "Baseline"
            : `Baseline #${build.baseline.number}`
        }
        newLabel={`New #${build.number}`}
        navigation={navigation}
      />
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-2.5">
        {rejecting ? (
          <RejectForm onSubmit={onReject} onCancel={onCancelReject} />
        ) : (
          <>
            <ReviewStatus snapshot={snapshot} />
            {canWrite && reviewable && (
              <div className="ml-auto flex items-center gap-2 max-sm:w-full">
                {(snapshot.reviewState === "approved" ||
                  snapshot.reviewState === "rejected") && (
                  <button
                    type="button"
                    className={buttonClass("ghost")}
                    onClick={onUndo}
                  >
                    <ArrowCounterClockwiseIcon size={14} />
                    Undo
                    <Kbd>u</Kbd>
                  </button>
                )}
                <button
                  type="button"
                  className={`${buttonClass("danger")} max-sm:flex-1`}
                  disabled={snapshot.reviewState === "rejected"}
                  onClick={onStartReject}
                >
                  Reject
                  <Kbd>r</Kbd>
                </button>
                <button
                  type="button"
                  className={`${buttonClass("primary")} max-sm:flex-1`}
                  disabled={snapshot.reviewState === "approved"}
                  onClick={onApprove}
                >
                  Approve
                  <Kbd inverted>a</Kbd>
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {snapshot.history.length > 0 && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-2 border-t border-border px-4 py-2 text-xs text-muted">
          <Link
            to="/$owner/$repo/baselines/$"
            params={{ owner, repo, _splat: snapshot.name }}
            search={{
              build:
                build.buildName === "default" ? undefined : build.buildName,
            }}
            className="hover:text-text"
          >
            History
          </Link>
          {snapshot.history.map((number) => (
            <Link
              key={number}
              to="/$owner/$repo/builds/$number"
              params={{ owner, repo, number: String(number) }}
              className="text-link tabular-nums"
            >
              #{number}
            </Link>
          ))}
        </p>
      )}
      <Details metadata={snapshot.metadata} />
    </>
  );
}

function ReviewStatus({ snapshot }: { snapshot: Snapshot }) {
  const review = snapshot.lastReview;
  if (snapshot.reviewState === "none") {
    return (
      <span className="text-xs text-muted">
        Matches the baseline, no review needed
      </span>
    );
  }
  if (snapshot.reviewState === "pending" || review === null) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <REVIEW_ICONS.pending size={14} className="text-pending" />
        Waiting for review
        {snapshot.rejectedIn !== null &&
          `, rejected in build #${snapshot.rejectedIn}`}
      </span>
    );
  }
  const Icon = REVIEW_ICONS[snapshot.reviewState];
  const verb =
    review.action === "approve"
      ? "Approved"
      : review.action === "reject"
        ? "Rejected"
        : "Review undone";
  const carriedFrom = review.carriedFrom;
  const who =
    carriedFrom !== null
      ? `in build #${carriedFrom.buildNumber}${carriedFrom.login === null ? "" : ` by @${carriedFrom.login}`} (carried over)`
      : review.source === "orphan"
        ? "as the first baseline"
        : review.login === null
          ? "automatically"
          : `by @${review.login}`;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <Icon
        size={14}
        weight="bold"
        className={`shrink-0 ${TONE_TEXT[snapshot.reviewState]}`}
      />
      <span className="truncate">
        {verb} {who} <RelativeTime timestamp={review.createdAt} />
        {review.comment && (
          <span className="text-text">: {review.comment}</span>
        )}
        {snapshot.notReviewedOnPr && (
          <span className="text-pending">, not reviewed on PR</span>
        )}
      </span>
    </span>
  );
}

function Details({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  const [open, setOpen] = useState(false);
  if (entries.length === 0) {
    return null;
  }
  const Caret = open ? CaretDownIcon : CaretRightIcon;
  return (
    <footer className="shrink-0 border-t border-border text-xs">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-1.5 px-4 text-muted hover:text-text"
        onClick={() => setOpen((value) => !value)}
      >
        <Caret size={12} />
        Details
        {!open && (
          <span className="min-w-0 truncate text-subtle">
            {entries
              .map(([key, value]) => `${key} ${String(value)}`)
              .join(", ")}
          </span>
        )}
      </button>
      {open && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 px-4 pb-3 pl-[34px]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted">{key}</dt>
              <dd className="mono truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </footer>
  );
}

function RejectForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(comment);
      }}
    >
      <input
        ref={input}
        value={comment}
        maxLength={500}
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="Why is this change wrong? (optional)"
        aria-label="Reject comment"
        className="h-8 min-w-0 flex-1 rounded-md bg-surface px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle focus:shadow-field-focus"
      />
      <button type="button" className={buttonClass("ghost")} onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className={buttonClass("danger")}>
        Reject
      </button>
    </form>
  );
}
