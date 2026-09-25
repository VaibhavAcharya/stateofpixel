import {
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
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type ReactNode, useEffect, useState } from "react";
import { AppHeader } from "../../../../components/AppHeader";
import { RequireAuth } from "../../../../components/RequireAuth";
import {
  BuildStatePill,
  DIFF_ICONS,
  type DiffStatus,
  LeadCopy,
  REVIEW_ICONS,
  RelativeTime,
  SkeletonRows,
  SupersededPill,
} from "../../../../components/ui";
import { Viewer } from "../../../../components/Viewer";
import { formatCount, formatPercent, shortSha } from "../../../../lib/format";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

export const Route = createFileRoute("/$owner/$repo/builds/$number")({
  component: BuildRoute,
});

type Build = NonNullable<FunctionReturnType<typeof api.builds.get>>;

const GROUPS: { status: DiffStatus; label: string }[] = [
  { status: "changed", label: "Changed" },
  { status: "added", label: "Added" },
  { status: "removed", label: "Removed" },
  { status: "failed", label: "Failed" },
  { status: "unchanged", label: "Unchanged" },
];

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
  owner,
  repo,
  number,
}: {
  projectId: Id<"projects">;
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
  return <BuildPage build={build} owner={owner} repo={repo} />;
}

function BuildPage({
  build,
  owner,
  repo,
}: {
  build: Build;
  owner: string;
  repo: string;
}) {
  const { snapshotId } = useParams({ strict: false });
  const [filter, setFilter] = useState("");
  const groups = GROUPS.map((group) => ({
    ...group,
    count: build.counts[group.status],
  }));
  const firstGroup = groups.find(
    (group) => group.count > 0 && group.status !== "unchanged",
  );
  const firstSnapshot = useQuery(
    api.snapshots.list,
    snapshotId === undefined && firstGroup !== undefined
      ? {
          buildId: build.buildId,
          diffStatus: firstGroup.status,
          paginationOpts: { numItems: 1, cursor: null },
        }
      : "skip",
  );
  const navigate = useNavigate();
  const firstSnapshotId = firstSnapshot?.page[0]?.id;

  useEffect(() => {
    if (firstSnapshotId !== undefined) {
      void navigate({
        to: "/$owner/$repo/builds/$number/snapshots/$snapshotId",
        params: {
          owner,
          repo,
          number: String(build.number),
          snapshotId: firstSnapshotId,
        },
        replace: true,
      });
    }
  }, [firstSnapshotId, navigate, owner, repo, build.number]);

  return (
    <>
      <BuildHeader build={build} owner={owner} repo={repo} />
      <Banners build={build} owner={owner} repo={repo} />
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-border bg-surface max-xl:w-[260px] max-md:max-h-64 max-md:w-full max-md:border-r-0 max-md:border-b">
          <div className="p-2">
            <label className="relative flex items-center">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute left-2 text-subtle"
              />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter"
                aria-label="Filter snapshots"
                className="h-7 w-full rounded-md bg-surface pr-2 pl-8 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] outline-none placeholder:text-subtle focus:shadow-field-focus"
              />
            </label>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {groups
              .filter((group) => group.count > 0)
              .map((group) => (
                <SnapshotGroup
                  key={group.status}
                  buildId={build.buildId}
                  status={group.status}
                  label={group.label}
                  count={group.count}
                  filter={filter}
                  selectedId={snapshotId}
                  linkParams={{ owner, repo, number: String(build.number) }}
                />
              ))}
          </nav>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          {snapshotId === undefined ? (
            <div className="p-6">
              {firstGroup === undefined ? (
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
              buildId={build.buildId}
              snapshotId={snapshotId as Id<"snapshots">}
              build={build}
            />
          )}
        </section>
      </div>
    </>
  );
}

function BuildHeader({
  build,
  owner,
  repo,
}: {
  build: Build;
  owner: string;
  repo: string;
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
  buildId,
  status,
  label,
  count,
  filter,
  selectedId,
  linkParams,
}: {
  buildId: Id<"builds">;
  status: DiffStatus;
  label: string;
  count: number;
  filter: string;
  selectedId: string | undefined;
  linkParams: { owner: string; repo: string; number: string };
}) {
  const [open, setOpen] = useState(status !== "unchanged");
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.snapshots.list,
    open ? { buildId, diffStatus: status } : "skip",
    { initialNumItems: 200 },
  );
  const needle = filter.trim().toLowerCase();
  const rows =
    needle === ""
      ? results
      : results.filter((row) => row.name.toLowerCase().includes(needle));
  const Caret = open ? CaretDown : CaretRight;

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-7 w-full items-center gap-1 px-2 text-xs font-medium text-muted hover:text-text"
        onClick={() => setOpen((value) => !value)}
      >
        <Caret size={12} />
        {label} ({formatCount(count)})
      </button>
      {open && (
        <ul>
          {rows.map((row) => {
            const ReviewIcon =
              row.reviewState === "none"
                ? DIFF_ICONS[row.diffStatus]
                : REVIEW_ICONS[row.reviewState];
            const selected = row.id === selectedId;
            return (
              <li key={row.id}>
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
                  <ReviewIcon
                    size={16}
                    className={`shrink-0 ${reviewColor(row.reviewState, row.diffStatus)}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {row.name}
                  </span>
                  {row.diffRatio !== null && (
                    <span className="text-xs text-muted tabular-nums">
                      {formatPercent(row.diffRatio)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {open && loadStatus === "CanLoadMore" && (
        <button
          type="button"
          className="h-7 px-2 text-xs text-link"
          onClick={() => loadMore(200)}
        >
          Load more
        </button>
      )}
    </div>
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
  buildId,
  snapshotId,
  build,
}: {
  buildId: Id<"builds">;
  snapshotId: Id<"snapshots">;
  build: Build;
}) {
  const snapshot = useQuery(api.snapshots.get, { buildId, snapshotId });
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
  const metadata = Object.entries(snapshot.metadata);
  return (
    <>
      <Viewer
        snapshot={snapshot}
        baselineLabel={
          build.baseline === null
            ? "Baseline"
            : `Baseline #${build.baseline.number}`
        }
        newLabel={`New #${build.number}`}
      />
      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted">
        <ReviewInfo review={snapshot.lastReview} />
        {metadata.map(([key, value]) => (
          <span key={key}>
            {key}: <span className="font-mono text-text">{String(value)}</span>
          </span>
        ))}
      </footer>
    </>
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
