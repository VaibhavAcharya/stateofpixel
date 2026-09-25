import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { AppHeader } from "../../../../components/AppHeader";
import { Page } from "../../../../components/Page";
import { ProjectHeader } from "../../../../components/ProjectHeader";
import { RequireAuth } from "../../../../components/RequireAuth";
import {
  DiffStatusPill,
  EmptyState,
  ProjectNotFound,
  RelativeTime,
  SkeletonRows,
  SnapshotName,
} from "../../../../components/ui";
import { useViewerSettings, Viewer } from "../../../../components/Viewer";
import { shortSha } from "../../../../lib/format";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

type Entry = NonNullable<
  FunctionReturnType<typeof api.baselines.history>
>["entries"][number];

export const Route = createFileRoute("/$owner/$repo/baselines/$")({
  validateSearch: (search: Record<string, unknown>): { suite?: string } => ({
    suite:
      typeof search.suite === "string" && search.suite !== ""
        ? search.suite
        : undefined,
  }),
  component: HistoryRoute,
});

function HistoryRoute() {
  const { owner, repo, _splat } = Route.useParams();
  const snapshotName = _splat ?? "";
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}/baselines/${snapshotName}`}>
      <AppHeader owner={owner} repo={repo} />
      <Page>
        <ProjectHeader owner={owner} repo={repo} tab="baselines" />
        <HistoryAccess owner={owner} repo={repo} snapshotName={snapshotName} />
      </Page>
    </RequireAuth>
  );
}

function HistoryAccess({
  owner,
  repo,
  snapshotName,
}: {
  owner: string;
  repo: string;
  snapshotName: string;
}) {
  const { suite } = Route.useSearch();
  const result = useProjectAccess(owner, repo);
  const history = useQuery(api.baselines.history, {
    owner,
    name: repo,
    buildName: suite,
    snapshotName,
  });
  if (result.state === "not_found") {
    return <ProjectNotFound />;
  }
  if (result.state === "loading" || !history) {
    return <SkeletonRows />;
  }
  if (history.entries.length === 0) {
    return (
      <EmptyState title="No history.">
        No build on {result.access.defaultBranch} changed this snapshot.
      </EmptyState>
    );
  }
  return (
    <History
      owner={owner}
      repo={repo}
      snapshotName={snapshotName}
      history={history.entries}
    />
  );
}

function History({
  owner,
  repo,
  snapshotName,
  history,
}: {
  owner: string;
  repo: string;
  snapshotName: string;
  history: Entry[];
}) {
  const settings = useViewerSettings();
  const [selected, setSelected] = useState<number[]>(
    history.slice(0, 2).map((entry) => entry.buildNumber),
  );
  const [newer, older] = history.filter((entry) =>
    selected.includes(entry.buildNumber),
  );
  const toggle = (buildNumber: number) =>
    setSelected((current) =>
      current.includes(buildNumber)
        ? current.filter((number) => number !== buildNumber)
        : [...current.slice(-1), buildNumber],
    );

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 max-lg:grid-cols-1">
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-medium" title={snapshotName}>
          <SnapshotName name={snapshotName} />
        </h2>
        <p className="text-xs text-muted">Pick two builds to compare them.</p>
        <ol className="border-t border-border">
          {history.map((entry) => (
            <HistoryEntry
              key={entry.buildNumber}
              owner={owner}
              repo={repo}
              entry={entry}
              selected={selected.includes(entry.buildNumber)}
              onToggle={() => toggle(entry.buildNumber)}
            />
          ))}
        </ol>
      </div>
      <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-border)]">
        {newer === undefined ? (
          <p className="m-auto text-sm text-muted">Pick a build.</p>
        ) : (
          <Viewer
            snapshot={{
              name: snapshotName,
              diffStatus: older === undefined ? newer.diffStatus : "changed",
              diffRatio: null,
              diffPixels: null,
              image: newer.image,
              baselineImage: older?.image ?? null,
              diffImage: null,
            }}
            settings={settings}
            baselineLabel={
              older === undefined ? "Baseline" : `#${older.buildNumber}`
            }
            newLabel={`#${newer.buildNumber}`}
            navigation={null}
          />
        )}
      </div>
    </div>
  );
}

function HistoryEntry({
  owner,
  repo,
  entry,
  selected,
  onToggle,
}: {
  owner: string;
  repo: string;
  entry: Entry;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={`flex gap-3 border-b border-border py-3 ${selected ? "bg-hover" : ""}`}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer gap-3 px-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Compare build #${entry.buildNumber}`}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="flex items-center gap-2">
            <Link
              to="/$owner/$repo/builds/$number"
              params={{ owner, repo, number: String(entry.buildNumber) }}
              className="font-medium tabular-nums hover:text-link"
            >
              #{entry.buildNumber}
            </Link>
            <DiffStatusPill status={entry.diffStatus} />
            <span className="ml-auto text-xs text-muted">
              <RelativeTime timestamp={entry.createdAt} />
            </span>
          </span>
          <span className="flex min-w-0 items-baseline gap-2 text-xs text-muted">
            <span className="mono shrink-0">{shortSha(entry.commitSha)}</span>
            <span className="truncate">{entry.commitMessage}</span>
          </span>
          {entry.mergedPrNumber !== null && (
            <span className="text-xs text-muted">
              PR #{entry.mergedPrNumber}
              {entry.approvedBy !== null &&
                `, approved by @${entry.approvedBy}`}
            </span>
          )}
        </span>
        {entry.image && (
          <img
            src={entry.image.url}
            alt=""
            loading="lazy"
            className="h-12 w-16 shrink-0 rounded-xs bg-surface-2 object-contain object-top"
          />
        )}
      </label>
    </li>
  );
}
