import { GitBranchIcon, GitPullRequestIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { UsePaginatedQueryReturnType } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import { type ReactNode, useCallback, useMemo } from "react";
import { AppHeader } from "../../../components/AppHeader";
import { CodeBlock } from "../../../components/CodeBlock";
import { columnHelper, DataTable } from "../../../components/DataTable";
import {
  FilterChip,
  ListToolbar,
  MultiSelectMenu,
} from "../../../components/ListControls";
import { Page } from "../../../components/Page";
import { ProjectHeader } from "../../../components/ProjectHeader";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  BuildStatePill,
  buttonClass,
  EmptyState,
  LeadCopy,
  listRowLinkClass,
  RelativeTime,
  SkeletonRows,
  Spinner,
  SupersededPill,
} from "../../../components/ui";
import { shortSha } from "../../../lib/format";
import { prefetchBuild } from "../../../lib/prefetch";
import { useListKeys } from "../../../lib/useListKeys";
import { useProjectAccess } from "../../../lib/useProjectAccess";

type BuildFilter =
  | "to_review"
  | "approved"
  | "rejected"
  | "no_changes"
  | "pending"
  | "expired"
  | "error";

type Search = {
  branch?: string;
  pr?: number;
  state?: string;
  order?: "asc";
};
type BuildRow = FunctionReturnType<typeof api.builds.list>["page"][number];

const PAGE_SIZE = 50;

const STATE_OPTIONS: { value: BuildFilter; label: string }[] = [
  { value: "to_review", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "no_changes", label: "No changes" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "error", label: "Error" },
];

const DEFAULT_STATES: BuildFilter[] = [
  "to_review",
  "approved",
  "rejected",
  "pending",
  "error",
];

function parseStates(value: string | undefined): BuildFilter[] {
  const states = value?.split(",") ?? DEFAULT_STATES;
  return STATE_OPTIONS.map((option) => option.value).filter((state) =>
    states.includes(state),
  );
}

function filterStates(value: string | undefined): BuildFilter[] | undefined {
  const states = parseStates(value);
  return states.length === STATE_OPTIONS.length ? undefined : states;
}

function formatStates(states: BuildFilter[]): string | undefined {
  const value = parseStates(states.join(",")).join(",");
  return value === DEFAULT_STATES.join(",") ? undefined : value;
}

export const Route = createFileRoute("/$owner/$repo/")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const pr = Number(search.pr);
    return {
      branch:
        typeof search.branch === "string" && search.branch !== ""
          ? search.branch
          : undefined,
      pr: Number.isInteger(pr) && pr > 0 ? pr : undefined,
      state:
        typeof search.state === "string"
          ? formatStates(parseStates(search.state))
          : undefined,
      order: search.order === "asc" ? "asc" : undefined,
    };
  },
  loader: ({ context, params }) => prefetchBuild(context.convex, params),
  component: ProjectPage,
});

function ProjectPage() {
  const { owner, repo } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}`}>
      <AppHeader owner={owner} repo={repo} />
      <Page>
        <ProjectHeader owner={owner} repo={repo} tab="builds" />
        <ProjectBuilds owner={owner} repo={repo} />
      </Page>
    </RequireAuth>
  );
}

function ProjectBuilds({ owner, repo }: { owner: string; repo: string }) {
  const search = Route.useSearch();
  const result = useProjectAccess(owner, repo);
  const builds = usePaginatedQuery(
    api.builds.list,
    {
      owner,
      name: repo,
      branch: search.branch,
      prNumber: search.pr,
      states: filterStates(search.state),
      order: search.order,
    },
    { initialNumItems: PAGE_SIZE },
  );
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
  if (!result.access.hasBuilds) {
    return <SetupCard owner={owner} repo={repo} />;
  }
  return <BuildsTable builds={builds} owner={owner} repo={repo} />;
}

const helper = columnHelper<BuildRow>();

function useBuildColumns({
  owner,
  repo,
  showBuildName,
  onFilter,
}: {
  owner: string;
  repo: string;
  showBuildName: boolean;
  onFilter: (search: Search) => void;
}) {
  return useMemo(
    () =>
      helper.columns([
        helper.accessor("number", {
          header: "Build",
          sortDescFirst: true,
          meta: { className: "w-24 font-medium tabular-nums" },
          cell: ({ row }) => (
            <Link
              to="/$owner/$repo/builds/$number"
              params={{ owner, repo, number: String(row.original.number) }}
              data-list-row
              className={listRowLinkClass}
            >
              <span className="text-muted">#</span>
              {row.original.number}
            </Link>
          ),
        }),
        helper.display({
          id: "status",
          header: "Status",
          meta: { className: "w-48" },
          cell: ({ row }) => (
            <span className="flex items-center gap-1.5">
              <BuildStatePill
                status={row.original.status}
                conclusion={row.original.conclusion}
                counts={row.original.counts}
                shards={row.original.shards}
              />
              {row.original.superseded && <SupersededPill />}
            </span>
          ),
        }),
        helper.display({
          id: "branch",
          header: "Branch",
          meta: { className: "w-52 max-lg:w-40" },
          cell: ({ row }) => (
            <FilterButton
              title={`Show builds on ${row.original.branch}`}
              onClick={() => onFilter({ branch: row.original.branch })}
            >
              <span className="mono truncate">
                {row.original.branch || "(no branch)"}
              </span>
            </FilterButton>
          ),
        }),
        helper.display({
          id: "commit",
          header: "Commit",
          meta: { className: "max-md:hidden" },
          cell: ({ row }) => (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="truncate">
                {row.original.commitMessage || "No commit message"}
              </span>
              <span className="mono shrink-0 text-muted">
                {shortSha(row.original.commitSha)}
              </span>
            </span>
          ),
        }),
        ...(showBuildName
          ? [
              helper.display({
                id: "suite",
                header: "Suite",
                meta: { className: "w-32 truncate text-muted max-lg:hidden" },
                cell: ({ row }) => row.original.buildName,
              }),
            ]
          : []),
        helper.display({
          id: "pr",
          header: "PR",
          meta: { className: "w-20 max-md:hidden" },
          cell: ({ row }) => {
            const pr = row.original.prNumber;
            return (
              pr !== null && (
                <FilterButton
                  title={`Show builds for pull request #${pr}`}
                  onClick={() => onFilter({ pr })}
                >
                  <span className="tabular-nums">#{pr}</span>
                </FilterButton>
              )
            );
          },
        }),
        helper.display({
          id: "created",
          header: "Created",
          meta: { className: "w-32 text-right text-muted" },
          cell: ({ row }) => (
            <RelativeTime timestamp={row.original.createdAt} />
          ),
        }),
      ]),
    [owner, repo, showBuildName, onFilter],
  );
}

function BuildsTable({
  builds: { results, status, loadMore },
  owner,
  repo,
}: {
  builds: UsePaginatedQueryReturnType<typeof api.builds.list>;
  owner: string;
  repo: string;
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  useListKeys();
  const update = useCallback(
    (next: Search) =>
      void navigate({ search: (prev) => ({ ...prev, ...next }) }),
    [navigate],
  );
  const columns = useBuildColumns({
    owner,
    repo,
    showBuildName: new Set(results.map((build) => build.buildName)).size > 1,
    onFilter: update,
  });
  const filtered =
    search.branch !== undefined ||
    search.pr !== undefined ||
    search.state !== undefined;

  if (status === "LoadingFirstPage") {
    return <SkeletonRows />;
  }

  return (
    <>
      <ListToolbar>
        <MultiSelectMenu
          label="Filter"
          values={parseStates(search.state)}
          options={STATE_OPTIONS}
          defaultValues={DEFAULT_STATES}
          onChange={(states) => update({ state: formatStates(states) })}
        />
        {search.branch !== undefined && (
          <FilterChip
            icon={<GitBranchIcon size={14} />}
            label="Branch"
            value={search.branch}
            mono
            onClear={() => update({ branch: undefined })}
          />
        )}
        {search.pr !== undefined && (
          <FilterChip
            icon={<GitPullRequestIcon size={14} />}
            label="Pull request"
            value={`#${search.pr}`}
            onClear={() => update({ pr: undefined })}
          />
        )}
        {filtered && (
          <button
            type="button"
            className={buttonClass("ghost")}
            onClick={() => void navigate({ search: { order: search.order } })}
          >
            Clear filters
          </button>
        )}
      </ListToolbar>
      <div className="max-sm:hidden">
        <DataTable
          columns={columns}
          data={results}
          getRowId={(build) => String(build.number)}
          sorting={[{ id: "number", desc: search.order !== "asc" }]}
          onSortingChange={([next]) =>
            update({ order: next?.desc === false ? "asc" : undefined })
          }
        />
      </div>
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
        <p className="py-6 text-sm text-muted">
          No builds match these filters.
        </p>
      )}
      {status === "CanLoadMore" && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className={buttonClass()}
            onClick={() => loadMore(PAGE_SIZE)}
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

function FilterButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      className="relative z-10 flex max-w-full items-center rounded-xs text-left hover:text-link"
      onClick={onClick}
    >
      {children}
    </button>
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
        data-list-row
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

function SetupCard({ owner, repo }: { owner: string; repo: string }) {
  return (
    <section className="flex max-w-[720px] flex-col gap-6 rounded-md border border-dotted border-field-border/60 bg-surface p-6 max-sm:p-4">
      <LeadCopy title="No builds yet.">
        Add the upload step to your GitHub Actions workflow and push a commit.
        On other CI, create a project token in{" "}
        <Link
          to="/$owner/$repo/settings"
          params={{ owner, repo }}
          className="text-link"
        >
          settings
        </Link>
        .
      </LeadCopy>
      <CodeBlock fileName=".github/workflows/visual.yml" code={SETUP_SNIPPET} />
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner size={14} />
        Waiting for the first build. This page updates by itself.
      </p>
    </section>
  );
}
