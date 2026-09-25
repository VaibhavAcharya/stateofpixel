import {
  ArrowUpRightIcon,
  GitBranchIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AppHeader } from "../../../components/AppHeader";
import { CodeBlock } from "../../../components/CodeBlock";
import { Page, PageHeader } from "../../../components/Page";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  BuildStatePill,
  buttonClass,
  EmptyState,
  LeadCopy,
  RelativeTime,
  SkeletonRows,
  Spinner,
  SupersededPill,
} from "../../../components/ui";
import { shortSha } from "../../../lib/format";
import { useProjectAccess } from "../../../lib/useProjectAccess";

type Search = { branch?: string };
type BuildRow = FunctionReturnType<typeof api.builds.list>["page"][number];

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
      <AppHeader owner={owner} repo={repo} />
      <Page>
        <PageHeader
          title={repo}
          meta={
            <>
              <Link to="/$owner" params={{ owner }} className="hover:text-text">
                {owner}
              </Link>
              <span aria-hidden>/</span>
              <span>Builds</span>
            </>
          }
          actions={
            <a
              href={`https://github.com/${owner}/${repo}`}
              className={buttonClass()}
            >
              Repository
              <ArrowUpRightIcon size={14} className="text-muted" />
            </a>
          }
        />
        <ProjectBuilds owner={owner} repo={repo} />
      </Page>
    </RequireAuth>
  );
}

function ProjectBuilds({ owner, repo }: { owner: string; repo: string }) {
  const result = useProjectAccess(owner, repo);
  if (result.state === "loading") {
    return <SkeletonRows />;
  }
  if (result.state === "not_found") {
    return (
      <EmptyState title="Project not found.">
        The repository may not exist here, or you do not have access to it on
        GitHub.
      </EmptyState>
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
  const showBuildName =
    new Set(results.map((build) => build.buildName)).size > 1;
  const filterBranch = (value: string) =>
    void navigate({ search: { branch: value } });

  if (status === "LoadingFirstPage") {
    return <SkeletonRows />;
  }
  if (results.length === 0 && branch === undefined) {
    return <SetupCard />;
  }

  return (
    <>
      {branch !== undefined && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-surface pr-1 pl-2 text-xs shadow-[inset_0_0_0_1px_var(--color-border)]">
            <GitBranchIcon size={14} className="text-muted" />
            <span className="text-muted">Branch</span>
            <span className="mono max-w-60 truncate">{branch}</span>
            <button
              type="button"
              aria-label="Clear branch filter"
              className={buttonClass("ghost", "icon-sm")}
              onClick={() => void navigate({ search: {} })}
            >
              <XIcon size={12} />
            </button>
          </span>
        </div>
      )}
      <table className="w-full table-fixed text-sm max-sm:hidden">
        <thead>
          <tr className="h-8 border-b border-border text-left text-2xs font-medium text-muted">
            <th className="w-20 px-3 font-medium">Build</th>
            <th className="w-48 px-3 font-medium">Status</th>
            <th className="w-52 px-3 font-medium max-lg:w-40">Branch</th>
            <th className="px-3 font-medium max-md:hidden">Commit</th>
            {showBuildName && (
              <th className="w-32 px-3 font-medium max-lg:hidden">Name</th>
            )}
            <th className="w-20 px-3 font-medium max-md:hidden">PR</th>
            <th className="w-32 px-3 text-right font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {results.map((build) => (
            <tr
              key={build.number}
              className="relative h-11 border-b border-border transition-colors duration-100 hover:bg-hover"
            >
              <td className="px-3 font-medium tabular-nums">
                <Link
                  to="/$owner/$repo/builds/$number"
                  params={{ owner, repo, number: String(build.number) }}
                  className="after:absolute after:inset-0"
                >
                  #{build.number}
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
                <BranchButton
                  branch={build.branch}
                  onClick={() => filterBranch(build.branch)}
                />
              </td>
              <td className="px-3 max-md:hidden">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate">
                    {build.commitMessage || "No commit message"}
                  </span>
                  <span className="mono shrink-0 text-muted">
                    {shortSha(build.commitSha)}
                  </span>
                </span>
              </td>
              {showBuildName && (
                <td className="truncate px-3 text-muted max-lg:hidden">
                  {build.buildName}
                </td>
              )}
              <td className="px-3 max-md:hidden">
                <PrLink owner={owner} repo={repo} prNumber={build.prNumber} />
              </td>
              <td className="px-3 text-right text-muted">
                <RelativeTime timestamp={build.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="border-t border-border sm:hidden">
        {results.map((build) => (
          <MobileBuildRow
            key={build.number}
            build={build}
            owner={owner}
            repo={repo}
          />
        ))}
      </ul>
      {results.length === 0 && (
        <p className="py-6 text-sm text-muted">No builds on this branch.</p>
      )}
      {status === "CanLoadMore" && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className={buttonClass()}
            onClick={() => loadMore(50)}
          >
            Load more
          </button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="mt-6 flex justify-center text-muted">
          <Spinner size={16} />
        </div>
      )}
    </>
  );
}

function BranchButton({
  branch,
  onClick,
}: {
  branch: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={`Show builds on ${branch}`}
      className="relative z-10 flex max-w-full items-center rounded-xs text-left hover:text-link"
      onClick={onClick}
    >
      <span className="mono truncate">{branch || "(no branch)"}</span>
    </button>
  );
}

function PrLink({
  owner,
  repo,
  prNumber,
}: {
  owner: string;
  repo: string;
  prNumber: number | null;
}) {
  if (prNumber === null) {
    return <span className="text-subtle">-</span>;
  }
  return (
    <a
      href={`https://github.com/${owner}/${repo}/pull/${prNumber}`}
      className="relative z-10 tabular-nums hover:text-link"
    >
      #{prNumber}
    </a>
  );
}

function MobileBuildRow({
  build,
  owner,
  repo,
}: {
  build: BuildRow;
  owner: string;
  repo: string;
}) {
  return (
    <li className="border-b border-border">
      <Link
        to="/$owner/$repo/builds/$number"
        params={{ owner, repo, number: String(build.number) }}
        className="flex flex-col gap-1.5 py-3 active:bg-hover"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium tabular-nums">#{build.number}</span>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={build.shards}
          />
          {build.superseded && <SupersededPill />}
          <span className="ml-auto text-xs text-muted">
            <RelativeTime timestamp={build.createdAt} />
          </span>
        </span>
        <span className="flex min-w-0 items-baseline gap-2 text-muted">
          <span className="mono shrink-0 text-text">{build.branch}</span>
          <span className="truncate">{build.commitMessage}</span>
        </span>
      </Link>
    </li>
  );
}

const SETUP_SNIPPET = `permissions:
  id-token: write

steps:
  - run: npx stateofpixel upload screenshots`;

function SetupCard() {
  return (
    <section className="flex max-w-[720px] flex-col gap-6 rounded-md border border-dotted border-field-border/60 bg-surface p-6 max-sm:p-4">
      <LeadCopy title="No builds yet.">
        Add the upload step to your GitHub Actions workflow and push a commit.
      </LeadCopy>
      <CodeBlock fileName=".github/workflows/visual.yml" code={SETUP_SNIPPET} />
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner size={14} />
        Waiting for the first build. This page updates by itself.
      </p>
    </section>
  );
}
