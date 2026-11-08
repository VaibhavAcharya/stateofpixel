import {
  CheckIcon,
  GitBranchIcon,
  GitPullRequestIcon,
} from "@phosphor-icons/react/ssr";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  Button,
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
} from "uiofcraft";
import { AppShell } from "../../../components/AppShell";
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
  AvatarStack,
  BuildStatePill,
  listRowLinkClass,
  ProjectNotFound,
  PrStateIcon,
  RelativeTime,
  ReviewBar,
  SkeletonRows,
  Spinner,
  SupersededMark,
} from "../../../components/ui";
import {
  api,
  type FunctionArgs,
  type FunctionReturnType,
  type UsePaginatedQueryReturnType,
  usePaginatedQuery,
} from "../../../lib/backend";
import { shortSha } from "../../../lib/format";
import { prefetchBuild } from "../../../lib/prefetch";
import { useListKeys } from "../../../lib/useListKeys";
import { useProjectAccess } from "../../../lib/useProjectAccess";
import workflow from "../../../snippets/workflow.yml?highlight";

type BuildFilter = NonNullable<
  FunctionArgs<typeof api.builds.list>["states"]
>[number];

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
  loader: ({ context, params }) => prefetchBuild(context.queryClient, params),
  component: ProjectPage,
});

function ProjectPage() {
  const { owner, repo } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}`}>
      <AppShell owner={owner} repo={repo} crumb="Builds">
        <Page>
          <ProjectHeader owner={owner} repo={repo} tab="builds" />
          <ProjectBuilds owner={owner} repo={repo} />
        </Page>
      </AppShell>
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
    return <ProjectNotFound />;
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
              className={`inline-flex items-center gap-1.5 ${listRowLinkClass}`}
            >
              <span>
                <span className="text-muted-foreground">#</span>
                {row.original.number}
              </span>
              {row.original.superseded && <SupersededMark />}
            </Link>
          ),
        }),
        helper.display({
          id: "status",
          header: "Status",
          meta: { className: "w-48" },
          cell: ({ row }) => (
            <span className="flex flex-col gap-1.5 py-2">
              <span className="flex flex-wrap items-center gap-1.5">
                <BuildStatePill
                  status={row.original.status}
                  conclusion={row.original.conclusion}
                  counts={row.original.counts}
                  shards={row.original.shards}
                  storageBlocked={row.original.storageBlocked}
                />
              </span>
              {row.original.status === "finalized" &&
                !row.original.storageBlocked && (
                  <ReviewBar counts={row.original.counts} />
                )}
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
              <span className="mono shrink-0 text-muted-foreground">
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
                meta: {
                  className:
                    "w-32 truncate text-muted-foreground max-lg:hidden",
                },
                cell: ({ row }) => row.original.buildName,
              }),
            ]
          : []),
        helper.display({
          id: "pr",
          header: "PR",
          meta: { className: "w-24 max-md:hidden" },
          cell: ({ row }) => {
            const pr = row.original.prNumber;
            return (
              pr !== null && (
                <FilterButton
                  title={`Show builds for pull request #${pr}`}
                  onClick={() => onFilter({ pr })}
                >
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <PrStateIcon state={row.original.prState} />#{pr}
                  </span>
                </FilterButton>
              )
            );
          },
        }),
        helper.display({
          id: "reviewers",
          header: "Reviewed by",
          meta: { className: "w-32 max-lg:hidden" },
          cell: ({ row }) =>
            row.original.reviewers.length === 0 ? (
              <span className="text-muted-foreground">-</span>
            ) : (
              <AvatarStack people={row.original.reviewers} />
            ),
        }),
        helper.display({
          id: "created",
          header: "Created",
          meta: { className: "w-32 text-right text-muted-foreground" },
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
          <Button
            variant="ghost"
            onClick={() => void navigate({ search: { order: search.order } })}
          >
            Clear filters
          </Button>
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
          getRowClassName={(build) =>
            build.superseded
              ? "text-muted-foreground *:data-[slot=table-cell]:opacity-72"
              : undefined
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
        <p className="py-6 text-sm text-muted-foreground">
          No builds match these filters.
        </p>
      )}
      {status === "CanLoadMore" && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="mt-6 flex justify-center text-muted-foreground">
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
        className="flex flex-col gap-1.5 py-3 active:bg-accent"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
            #{build.number}
            {build.superseded && <SupersededMark />}
          </span>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={build.shards}
            storageBlocked={build.storageBlocked}
          />
          {build.prNumber !== null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
              <PrStateIcon state={build.prState} />#{build.prNumber}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            <RelativeTime timestamp={build.createdAt} />
          </span>
        </span>
        <span className="flex min-w-0 items-baseline gap-2 text-muted-foreground">
          <span className="mono shrink-0 text-foreground">{build.branch}</span>
          <span className="truncate">{build.commitMessage}</span>
        </span>
      </Link>
    </li>
  );
}

function SetupCard({ owner, repo }: { owner: string; repo: string }) {
  return (
    <CardFrame className="max-w-[880px]">
      <CardFrameHeader className="py-3">
        <CardFrameTitle>No builds yet.</CardFrameTitle>
      </CardFrameHeader>
      <Card className="overflow-hidden">
        <ol className="divide-y">
          <SetupStep done title="Install the GitHub App">
            {repo} is a project, so the app is installed on it.
          </SetupStep>
          <SetupStep title="Add the upload step">
            Add it to your GitHub Actions workflow. On other CI, create a
            project token in{" "}
            <Link
              to="/$owner/$repo/settings"
              params={{ owner, repo }}
              className="text-link"
            >
              settings
            </Link>
            . The{" "}
            <Link to="/docs" className="text-link">
              Quickstart
            </Link>{" "}
            has the full setup.
            <div className="mt-4">
              <CodeBlock
                fileName=".github/workflows/visual.yml"
                {...workflow}
              />
            </div>
          </SetupStep>
          <SetupStep waiting title="Push a commit">
            Waiting for the first build. This page updates by itself.
          </SetupStep>
        </ol>
      </Card>
    </CardFrame>
  );
}

function SetupStep({
  title,
  done = false,
  waiting = false,
  children,
}: {
  title: string;
  done?: boolean;
  waiting?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4 p-5 sm:p-6">
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
          done ? "border-approved/40 bg-approved-bg text-approved" : "bg-card"
        }`}
      >
        {done ? (
          <CheckIcon size={14} weight="bold" aria-label="Done" />
        ) : waiting ? (
          <Spinner size={14} className="text-muted-foreground" />
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{title}</p>
        <div className="mt-1 text-muted-foreground text-sm">{children}</div>
      </div>
    </li>
  );
}
