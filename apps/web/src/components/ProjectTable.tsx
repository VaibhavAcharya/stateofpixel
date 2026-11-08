import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Button } from "uiofcraft";
import {
  api,
  type FunctionReturnType,
  usePaginatedQuery,
} from "../lib/backend";
import {
  DEFAULT_ORDER,
  type ProjectSearch,
  type ProjectSort,
} from "../lib/projectSearch";
import { columnHelper, DataTable, type SortingState } from "./DataTable";
import {
  AvatarStack,
  BuildStatePill,
  listRowLinkClass,
  ProjectMark,
  RelativeTime,
  ReviewBar,
  SkeletonRows,
  Spinner,
} from "./ui";

type ProjectRow = FunctionReturnType<
  typeof api.accounts.projects
>["page"][number];

const PAGE_SIZE = 25;
const helper = columnHelper<ProjectRow>();

const columns = helper.columns([
  helper.accessor("name", {
    header: "Project",
    cell: ({ row }) => {
      const build = row.original.latestBuild;
      return (
        <Link
          to="/$owner/$repo"
          params={{ owner: row.original.owner, repo: row.original.name }}
          data-list-row
          className={`flex min-w-0 items-center gap-3 ${listRowLinkClass}`}
        >
          <ProjectMark name={`${row.original.owner}/${row.original.name}`} />
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <span className="truncate">{row.original.name}</span>
              {row.original.private && (
                <LockSimpleIcon
                  size={12}
                  aria-label="Private"
                  className="shrink-0 text-muted-foreground"
                />
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {build === null ? (
                "No builds yet"
              ) : (
                <>
                  <span className="tabular-nums">#{build.number}</span>
                  <span aria-hidden>·</span>
                  <span className="mono truncate">{build.branch}</span>
                </>
              )}
            </span>
          </span>
        </Link>
      );
    },
  }),
  helper.display({
    id: "build",
    header: "Latest build",
    meta: { className: "w-52 max-sm:w-36" },
    cell: ({ row }) => {
      const build = row.original.latestBuild;
      if (build === null) {
        return null;
      }
      return (
        <span className="flex flex-col items-start gap-1.5">
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={{ done: 0, total: null }}
            storageBlocked={build.storageBlocked}
          />
          {build.status === "finalized" && !build.storageBlocked && (
            <ReviewBar counts={build.counts} />
          )}
        </span>
      );
    },
  }),
  helper.display({
    id: "reviewers",
    header: "Reviewed by",
    meta: { className: "w-36 max-md:hidden" },
    cell: ({ row }) => {
      const reviewers = row.original.latestBuild?.reviewers ?? [];
      return reviewers.length === 0 ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <AvatarStack people={reviewers} />
      );
    },
  }),
  helper.accessor((project) => project.latestBuild?.createdAt, {
    id: "updated",
    header: "Updated",
    sortDescFirst: true,
    meta: { className: "w-32 text-right text-muted-foreground max-sm:hidden" },
    cell: ({ row }) =>
      row.original.latestBuild && (
        <RelativeTime timestamp={row.original.latestBuild.createdAt} />
      ),
  }),
]);

export function ProjectTable({
  login,
  search,
  onSearchChange,
  empty,
}: {
  login: string;
  search: ProjectSearch;
  onSearchChange: (search: ProjectSearch) => void;
  empty: string;
}) {
  const sort = search.sort ?? "name";
  const order = search.order ?? DEFAULT_ORDER[sort];
  const { results, status, loadMore } = usePaginatedQuery(
    api.accounts.projects,
    { login, search: search.q, sort, order },
    { initialNumItems: PAGE_SIZE },
  );
  const sorting: SortingState =
    search.q === undefined ? [{ id: sort, desc: order === "desc" }] : [];

  if (status === "LoadingFirstPage") {
    return <SkeletonRows rows={3} />;
  }
  if (results.length === 0) {
    return (
      <p className="border-t border-border py-4 text-sm text-muted-foreground">
        {search.q === undefined ? empty : `No projects match "${search.q}".`}
      </p>
    );
  }
  return (
    <>
      <DataTable
        columns={columns}
        data={results}
        getRowId={(project) => `${project.owner}/${project.name}`}
        sorting={sorting}
        onSortingChange={
          search.q === undefined
            ? ([next]) => {
                const nextSort = (next?.id ?? "name") as ProjectSort;
                const nextOrder = next?.desc ? "desc" : "asc";
                onSearchChange({
                  ...search,
                  sort: nextSort === "name" ? undefined : nextSort,
                  order:
                    nextOrder === DEFAULT_ORDER[nextSort]
                      ? undefined
                      : nextOrder,
                });
              }
            : undefined
        }
        rowClassName="h-16"
      />
      {status === "CanLoadMore" && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}
      {status === "LoadingMore" && (
        <div className="mt-4 flex justify-center text-muted-foreground">
          <Spinner size={16} />
        </div>
      )}
    </>
  );
}
