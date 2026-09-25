import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { AppHeader } from "../../../components/AppHeader";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  BuildStatePill,
  buttonClass,
  LeadCopy,
  RelativeTime,
  SkeletonRows,
  SupersededPill,
} from "../../../components/ui";
import { shortSha } from "../../../lib/format";
import { useProjectAccess } from "../../../lib/useProjectAccess";

type Search = { branch?: string };

export const Route = createFileRoute("/$owner/$repo/")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.branch === "string" && search.branch !== ""
      ? { branch: search.branch }
      : {},
  component: ProjectPage,
});

function ProjectPage() {
  const { owner, repo } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}`}>
      <AppHeader owner={owner} />
      <main className="max-w-[1200px] px-6 pt-6 pb-12 max-sm:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.025em]">
          <Link
            to="/$owner"
            params={{ owner }}
            className="text-muted hover:text-text"
          >
            {owner}
          </Link>{" "}
          / {repo}
        </h1>
        <ProjectBuilds owner={owner} repo={repo} />
      </main>
    </RequireAuth>
  );
}

function ProjectBuilds({ owner, repo }: { owner: string; repo: string }) {
  const result = useProjectAccess(owner, repo);
  if (result.state === "loading") {
    return (
      <div className="mt-6">
        <SkeletonRows />
      </div>
    );
  }
  if (result.state === "not_found") {
    return (
      <div className="mt-6">
        <LeadCopy title="Project not found.">
          The repository may not exist here, or you do not have access to it on
          GitHub.
        </LeadCopy>
      </div>
    );
  }
  return (
    <BuildsTable
      projectId={result.access.projectId}
      owner={owner}
      repo={repo}
    />
  );
}

function BuildsTable({
  projectId,
  owner,
  repo,
}: {
  projectId: Id<"projects">;
  owner: string;
  repo: string;
}) {
  const { branch } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { results, status, loadMore } = usePaginatedQuery(
    api.builds.list,
    { projectId, branch },
    { initialNumItems: 50 },
  );
  const buildNames = new Set(results.map((build) => build.buildName));

  if (status === "LoadingFirstPage") {
    return (
      <div className="mt-6">
        <SkeletonRows />
      </div>
    );
  }
  if (results.length === 0 && branch === undefined) {
    return <SetupCard />;
  }

  return (
    <div className="mt-6">
      {branch !== undefined && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Branch</span>
          <span className="font-mono">{branch}</span>
          <button
            type="button"
            className={buttonClass("ghost", "sm")}
            onClick={() => void navigate({ search: {} })}
          >
            Clear
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="h-8 border-b border-border text-left text-2xs font-medium text-muted">
            <th className="px-3 text-right font-medium">#</th>
            <th className="px-3 font-medium">Status</th>
            <th className="px-3 font-medium">Branch</th>
            <th className="px-3 font-medium max-md:hidden">Commit</th>
            <th className="px-3 font-medium max-md:hidden">PR</th>
            {buildNames.size > 1 && (
              <th className="px-3 font-medium">Build name</th>
            )}
            <th className="px-3 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {results.map((build) => (
            <tr
              key={build.number}
              className="relative h-10 border-b border-border hover:bg-hover"
            >
              <td className="px-3 text-right tabular-nums">
                <Link
                  to="/$owner/$repo/builds/$number"
                  params={{ owner, repo, number: String(build.number) }}
                  className="after:absolute after:inset-0"
                >
                  {build.number}
                </Link>
              </td>
              <td className="px-3">
                <span className="flex items-center gap-1.5">
                  <BuildStatePill
                    status={build.status}
                    conclusion={build.conclusion}
                    counts={build.counts}
                    shards={build.shards}
                  />
                  {build.superseded && <SupersededPill />}
                </span>
              </td>
              <td className="px-3">
                <button
                  type="button"
                  className="relative z-10 font-mono hover:text-link"
                  onClick={() =>
                    void navigate({ search: { branch: build.branch } })
                  }
                >
                  {build.branch}
                </button>
              </td>
              <td className="max-w-80 truncate px-3 max-md:hidden">
                {build.commitMessage}{" "}
                <span className="font-mono text-muted">
                  {shortSha(build.commitSha)}
                </span>
              </td>
              <td className="px-3 max-md:hidden">
                {build.prNumber === null ? (
                  <span className="text-muted">-</span>
                ) : (
                  <a
                    href={`https://github.com/${owner}/${repo}/pull/${build.prNumber}`}
                    className="relative z-10 text-link"
                  >
                    #{build.prNumber}
                  </a>
                )}
              </td>
              {buildNames.size > 1 && (
                <td className="px-3 font-mono">{build.buildName}</td>
              )}
              <td className="px-3 text-right text-muted tabular-nums">
                <RelativeTime timestamp={build.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length === 0 && (
        <p className="mt-6 text-sm text-muted">No builds on this branch.</p>
      )}
      {status === "CanLoadMore" && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className={buttonClass()}
            onClick={() => loadMore(50)}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

const SETUP_SNIPPET = `permissions:
  id-token: write

steps:
  - run: npx stateofpixel upload screenshots`;

function SetupCard() {
  return (
    <section className="mt-6 max-w-[720px] rounded-md border border-dotted border-border bg-surface p-6">
      <LeadCopy title="No builds yet.">
        Add the step to your CI and push a commit.
      </LeadCopy>
      <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-sm leading-[1.8]">
        {SETUP_SNIPPET}
      </pre>
      <p className="mt-4 text-sm text-muted">Waiting for your first build...</p>
    </section>
  );
}
