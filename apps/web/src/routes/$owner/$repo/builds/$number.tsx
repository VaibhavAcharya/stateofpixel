import {
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import {
  type ReactNode,
  type RefObject,
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
  Kbd,
  LeadCopy,
  REVIEW_ICONS,
  RelativeTime,
  type ReviewState,
  SkeletonRows,
  SupersededPill,
} from "../../../../components/ui";
import {
  MODES,
  useViewerSettings,
  Viewer,
  type ViewerSettings,
} from "../../../../components/Viewer";
import { formatCount, formatPercent, shortSha } from "../../../../lib/format";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

export const Route = createFileRoute("/$owner/$repo/builds/$number")({
  component: BuildRoute,
});

type Build = NonNullable<FunctionReturnType<typeof api.builds.get>>;
type SnapshotRow = FunctionReturnType<
  typeof api.snapshots.list
>["page"][number];
type ReviewAction = "approve" | "reject" | "undo";

const GROUPS: { status: DiffStatus; label: string }[] = [
  { status: "changed", label: "Changed" },
  { status: "added", label: "Added" },
  { status: "removed", label: "Removed" },
  { status: "failed", label: "Failed" },
  { status: "unchanged", label: "Unchanged" },
];

const NEXT_STATE: Record<ReviewAction, ReviewState> = {
  approve: "approved",
  reject: "rejected",
  undo: "pending",
};

const ACTION_VERBS: Record<ReviewAction, string> = {
  approve: "approve",
  reject: "reject",
  undo: "undo the review of",
};

function BuildRoute() {
  const { owner, repo, number } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}/builds/${number}`}>
      <div className="flex h-dvh flex-col">
        <AppHeader owner={owner} />
        <BuildAccess owner={owner} repo={repo} number={Number(number)} />
      </div>
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
  const result = useProjectAccess(owner, repo);
  if (result.state === "loading") {
    return (
      <div className="p-6">
        <SkeletonRows />
      </div>
    );
  }
  if (result.state === "not_found") {
    return <NotFound title="Project not found." />;
  }
  return (
    <BuildLoader
      projectId={result.access.projectId}
      canWrite={result.access.canWrite}
      owner={owner}
      repo={repo}
      number={number}
    />
  );
}

function NotFound({ title }: { title: string }) {
  return (
    <div className="p-6">
      <LeadCopy title={title}>
        It may not exist, or you do not have access to the repository on GitHub.
      </LeadCopy>
    </div>
  );
}

function BuildLoader({
  projectId,
  canWrite,
  owner,
  repo,
  number,
}: {
  projectId: Id<"projects">;
  canWrite: boolean;
  owner: string;
  repo: string;
  number: number;
}) {
  const build = useQuery(
    api.builds.get,
    Number.isInteger(number) ? { projectId, number } : "skip",
  );
  if (build === undefined && Number.isInteger(number)) {
    return (
      <div className="p-6">
        <SkeletonRows />
      </div>
    );
  }
  if (!build) {
    return <NotFound title="Build not found." />;
  }
  return (
    <BuildPage build={build} canWrite={canWrite} owner={owner} repo={repo} />
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
    if (args.snapshotIds === "all") {
      return;
    }
    const next = NEXT_STATE[args.action];
    const ids = new Set<string>(args.snapshotIds);
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.list,
    )) {
      if (value === undefined || queryArgs.buildId !== args.buildId) {
        continue;
      }
      store.setQuery(api.snapshots.list, queryArgs, {
        ...value,
        page: value.page.map((row) =>
          ids.has(row.id) && row.reviewState !== "none"
            ? { ...row, reviewState: next }
            : row,
        ),
      });
    }
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.get,
    )) {
      if (value && ids.has(value.id) && value.reviewState !== "none") {
        store.setQuery(api.snapshots.get, queryArgs, {
          ...value,
          reviewState: next,
        });
      }
    }
  });
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
  const [unchangedOpen, setUnchangedOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const filterInput = useRef<HTMLInputElement>(null);
  const settings = useViewerSettings();
  const { toasts, show, dismiss } = useToasts();
  const applyReview = useApplyReview();
  const groups = useSnapshotGroups(build.buildId, build.counts, unchangedOpen);
  const canReview =
    canWrite && build.status === "finalized" && !build.superseded;

  const needle = filter.trim().toLowerCase();
  const visible = (rows: SnapshotRow[]) =>
    needle === ""
      ? rows
      : rows.filter((row) => row.name.toLowerCase().includes(needle));
  const ordered = GROUPS.flatMap((group) =>
    visible(groups[group.status].results),
  );
  const currentIndex = ordered.findIndex((row) => row.id === snapshotId);
  const current = currentIndex === -1 ? undefined : ordered[currentIndex];
  const linkParams = { owner, repo, number: String(build.number) };

  const select = (row: SnapshotRow | undefined) => {
    if (row !== undefined) {
      settings.setShowBaseline(false);
      void navigate({
        to: "/$owner/$repo/builds/$number/snapshots/$snapshotId",
        params: { ...linkParams, snapshotId: row.id },
      });
    }
  };

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
    const nextPending = [
      ...ordered.slice(currentIndex + 1),
      ...ordered.slice(0, currentIndex),
    ].find((row) => row.reviewState === "pending");
    select(nextPending);
  };

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
        target?.closest("input, textarea, select, [contenteditable]") ||
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
          select(ordered[currentIndex + 1] ?? ordered[0]);
          break;
        case "k":
          select(ordered[currentIndex - 1] ?? ordered[ordered.length - 1]);
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
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-border bg-surface max-xl:w-[260px] max-md:max-h-64 max-md:w-full max-md:border-r-0 max-md:border-b">
          <FilterInput
            inputRef={filterInput}
            value={filter}
            onChange={setFilter}
          />
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {GROUPS.filter((group) => build.counts[group.status] > 0).map(
              (group) => {
                const query = groups[group.status];
                const open =
                  group.status === "unchanged" ? unchangedOpen : true;
                return (
                  <SnapshotGroup
                    key={group.status}
                    label={group.label}
                    count={build.counts[group.status]}
                    open={open}
                    onToggle={
                      group.status === "unchanged"
                        ? () => setUnchangedOpen((value) => !value)
                        : undefined
                    }
                    rows={visible(query.results)}
                    canLoadMore={query.status === "CanLoadMore"}
                    onLoadMore={() => query.loadMore(200)}
                    selectedId={snapshotId}
                    linkParams={linkParams}
                  />
                );
              },
            )}
          </nav>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          {snapshotId === undefined ? (
            <div className="p-6">
              {firstId === undefined &&
              build.counts.changed + build.counts.added === 0 ? (
                <LeadCopy title="Nothing to review.">
                  {formatCount(build.counts.unchanged)} snapshots match the
                  baseline.
                </LeadCopy>
              ) : (
                <SkeletonRows rows={1} height="h-96" />
              )}
            </div>
          ) : (
            <SnapshotDetail
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
            />
          )}
        </section>
      </div>
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <Toasts toasts={toasts} dismiss={dismiss} />
    </>
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
    <div className="p-2">
      <label className="relative flex items-center">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-2 text-subtle"
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
          placeholder="Filter"
          aria-label="Filter snapshots"
          className="h-7 w-full rounded-md bg-surface pr-8 pl-8 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] outline-none placeholder:text-subtle focus:shadow-field-focus"
        />
        {value === "" && (
          <span className="pointer-events-none absolute right-1.5">
            <Kbd>/</Kbd>
          </span>
        )}
      </label>
    </div>
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
  return (
    <header className="shrink-0 border-b border-border bg-surface px-6 py-3 max-sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link
          to="/$owner/$repo"
          params={{ owner, repo }}
          className="text-muted hover:text-text"
        >
          {owner} / {repo}
        </Link>
        <h1 className="text-xl font-semibold tabular-nums tracking-[-0.025em]">
          #{build.number}
        </h1>
        <span className="font-mono">{build.branch}</span>
        <a
          href={`https://github.com/${owner}/${repo}/commit/${build.commitSha}`}
          className="font-mono text-muted hover:text-link"
        >
          {shortSha(build.commitSha)}
        </a>
        <span className="max-w-96 truncate">{build.commitMessage}</span>
        {build.prNumber !== null && (
          <a
            href={`https://github.com/${owner}/${repo}/pull/${build.prNumber}`}
            className="text-link"
          >
            PR #{build.prNumber}
          </a>
        )}
        <span className="text-muted">
          {build.baseline === null ? (
            "First build, no baseline"
          ) : (
            <>
              vs baseline{" "}
              <Link
                to="/$owner/$repo/builds/$number"
                params={{ owner, repo, number: String(build.baseline.number) }}
                className="text-link"
              >
                #{build.baseline.number}
              </Link>{" "}
              ({build.baseline.branch})
            </>
          )}
        </span>
        <span className="text-muted">
          <RelativeTime timestamp={build.createdAt} />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm tabular-nums">
        <BuildStatePill
          status={build.status}
          conclusion={build.conclusion}
          counts={build.counts}
          shards={build.shards}
        />
        {build.superseded && <SupersededPill />}
        {GROUPS.filter((group) => build.counts[group.status] > 0).map(
          (group) => (
            <span key={group.status} className="text-muted">
              <span className="text-text">
                {formatCount(build.counts[group.status])}
              </span>{" "}
              {group.label.toLowerCase()}
            </span>
          ),
        )}
        <div className="ml-auto flex items-center gap-2">
          {canWrite ? (
            <>
              <button
                type="button"
                className={buttonClass("danger")}
                disabled={!canReview || build.counts.pending === 0}
                onClick={onRejectAll}
              >
                Reject
              </button>
              <button
                type="button"
                className={buttonClass("primary")}
                disabled={!canReview || build.counts.pending === 0}
                onClick={onApproveAll}
              >
                Approve all
              </button>
            </>
          ) : (
            <span className="text-xs text-muted">
              You need write access on GitHub to review
            </span>
          )}
        </div>
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
  const banners: { key: string; tone: string; content: ReactNode }[] = [];
  if (build.supersededBy !== null) {
    banners.push({
      key: "superseded",
      tone: "bg-unchanged-bg",
      content: (
        <>
          A newer build exists for this PR.{" "}
          <Link
            to="/$owner/$repo/builds/$number"
            params={{ owner, repo, number: String(build.supersededBy) }}
            className="text-link"
          >
            Open #{build.supersededBy}
          </Link>
        </>
      ),
    });
  }
  if (build.status === "pending") {
    banners.push({
      key: "pending",
      tone: "bg-added-bg",
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
      content: "This build never finished.",
    });
  }
  if (build.status === "error") {
    banners.push({
      key: "error",
      tone: "bg-failed-bg",
      content: build.ciRunUrl ? (
        <>
          Upload failed.{" "}
          <a href={build.ciRunUrl} className="text-link">
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
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-6 py-2 max-sm:px-4">
      {banners.map((banner) => (
        <p
          key={banner.key}
          className={`flex min-h-9 items-center rounded-md px-3 py-2 text-sm ${banner.tone}`}
        >
          <span>{banner.content}</span>
        </p>
      ))}
    </div>
  );
}

function SnapshotGroup({
  label,
  count,
  open,
  onToggle,
  rows,
  canLoadMore,
  onLoadMore,
  selectedId,
  linkParams,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle?: () => void;
  rows: SnapshotRow[];
  canLoadMore: boolean;
  onLoadMore: () => void;
  selectedId: string | undefined;
  linkParams: { owner: string; repo: string; number: string };
}) {
  const Caret = open ? CaretDown : CaretRight;

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        disabled={onToggle === undefined}
        className="flex h-7 w-full items-center gap-1 px-2 text-xs font-medium text-muted enabled:hover:text-text"
        onClick={onToggle}
      >
        <Caret size={12} />
        {label} ({formatCount(count)})
      </button>
      {open && (
        <ul>
          {rows.map((row) => (
            <SnapshotRowLink
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              linkParams={linkParams}
            />
          ))}
        </ul>
      )}
      {open && canLoadMore && (
        <button
          type="button"
          className="h-7 px-2 text-xs text-link"
          onClick={onLoadMore}
        >
          Load more
        </button>
      )}
    </div>
  );
}

function SnapshotRowLink({
  row,
  selected,
  linkParams,
}: {
  row: SnapshotRow;
  selected: boolean;
  linkParams: { owner: string; repo: string; number: string };
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

  return (
    <li ref={item}>
      <Link
        to="/$owner/$repo/builds/$number/snapshots/$snapshotId"
        params={{ ...linkParams, snapshotId: row.id }}
        title={row.name}
        aria-current={selected ? "page" : undefined}
        className={`relative flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-hover ${
          selected
            ? "bg-hover before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-link"
            : ""
        }`}
      >
        <Icon
          size={16}
          className={`shrink-0 ${reviewColor(row.reviewState, row.diffStatus)}`}
        />
        <span className="min-w-0 flex-1 truncate font-mono">{row.name}</span>
        {row.diffRatio !== null && (
          <span className="text-xs text-muted tabular-nums">
            {formatPercent(row.diffRatio)}
          </span>
        )}
      </Link>
    </li>
  );
}

function reviewColor(reviewState: string, diffStatus: DiffStatus): string {
  switch (reviewState) {
    case "pending":
      return "text-pending";
    case "approved":
      return "text-approved";
    case "rejected":
      return "text-rejected";
    default:
      return `text-${diffStatus}`;
  }
}

function SnapshotDetail({
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
}: {
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
}) {
  const snapshot = useQuery(api.snapshots.get, {
    buildId: build.buildId,
    snapshotId,
  });
  if (snapshot === undefined) {
    return (
      <div className="p-6">
        <SkeletonRows rows={1} height="h-96" />
      </div>
    );
  }
  if (snapshot === null) {
    return <NotFound title="Snapshot not found." />;
  }
  const reviewable = canReview && snapshot.reviewState !== "none";
  const metadata = Object.entries(snapshot.metadata);

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
      />
      <div className="flex h-14 shrink-0 items-center gap-3 border-t border-border px-4">
        {canWrite &&
          (rejecting ? (
            <RejectForm onSubmit={onReject} onCancel={onCancelReject} />
          ) : (
            <button
              type="button"
              className={buttonClass("danger")}
              disabled={!reviewable || snapshot.reviewState === "rejected"}
              onClick={onStartReject}
            >
              Reject <Kbd>r</Kbd>
            </button>
          ))}
        <span className="min-w-0 flex-1 truncate text-center text-xs text-muted">
          <ReviewInfo review={snapshot.lastReview} />
        </span>
        {canWrite &&
          reviewable &&
          (snapshot.reviewState === "approved" ||
            snapshot.reviewState === "rejected") && (
            <button
              type="button"
              className={buttonClass("ghost")}
              onClick={onUndo}
            >
              <ArrowCounterClockwise size={16} /> Undo <Kbd>u</Kbd>
            </button>
          )}
        {canWrite && (
          <button
            type="button"
            className={buttonClass("primary")}
            disabled={!reviewable || snapshot.reviewState === "approved"}
            onClick={onApprove}
          >
            Approve <Kbd>a</Kbd>
          </button>
        )}
      </div>
      {metadata.length > 0 && (
        <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted">
          {metadata.map(([key, value]) => (
            <span key={key}>
              {key}:{" "}
              <span className="font-mono text-text">{String(value)}</span>
            </span>
          ))}
        </footer>
      )}
    </>
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
      className="flex items-center gap-2"
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
        placeholder="Comment (optional)"
        aria-label="Reject comment"
        className="h-8 w-64 rounded-md bg-surface px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] outline-none placeholder:text-subtle focus:shadow-field-focus max-sm:w-40"
      />
      <button type="submit" className={buttonClass("danger")}>
        Reject
      </button>
      <button type="button" className={buttonClass("ghost")} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function ReviewInfo({
  review,
}: {
  review: NonNullable<
    FunctionReturnType<typeof api.snapshots.get>
  >["lastReview"];
}) {
  if (review === null) {
    return <span>Not reviewed</span>;
  }
  const verb =
    review.action === "approve"
      ? "Approved"
      : review.action === "reject"
        ? "Rejected"
        : "Review undone";
  const who =
    review.source === "orphan"
      ? "as the first baseline"
      : review.login === null
        ? "automatically"
        : `by @${review.login}`;
  return (
    <span>
      {verb} {who} <RelativeTime timestamp={review.createdAt} />
      {review.comment && `: ${review.comment}`}
    </span>
  );
}
