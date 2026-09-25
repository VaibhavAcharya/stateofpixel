import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { usePaginatedQuery } from "convex-helpers/react/cache/hooks";
import {
  DEFAULT_ORDER,
  type ProjectSearch,
  type ProjectSort,
} from "../lib/projectSearch";
import { columnHelper, DataTable, type SortingState } from "./DataTable";
import {
  BuildStatePill,
  buttonClass,
  listRowLinkClass,
  RelativeTime,
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
    cell: ({ row }) => (
      <Link
        to="/$owner/$repo"
        params={{ owner: row.original.owner, repo: row.original.name }}
        data-list-row
        className={`flex min-w-0 items-center gap-2 font-medium ${listRowLinkClass}`}
      >
        <span className="truncate">{row.original.name}</span>
        {row.original.private && (
          <LockSimpleIcon
            size={12}
            aria-label="Private"
            className="shrink-0 text-muted"
          />
        )}
      </Link>
    ),
  }),
  helper.display({
    id: "build",
    header: "Latest build",
    meta: { className: "w-48 max-sm:w-36" },
    cell: ({ row }) => {
      const build = row.original.latestBuild;
      if (build === null) {
        return <span className="text-muted">No builds yet</span>;
      }
      return (
        <span className="flex items-center gap-2">
          <span className="text-muted tabular-nums">#{build.number}</span>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={{ done: 0, total: null }}
            storageBlocked={build.storageBlocked}
          />
        </span>
      );
    },
  }),
  helper.display({
    id: "branch",
    header: "Branch",
    meta: { className: "w-56 truncate max-md:hidden" },
    cell: ({ row }) =>
      row.original.latestBuild && (
        <span className="mono">{row.original.latestBuild.branch}</span>
      ),
  }),
  helper.accessor((project) => project.latestBuild?.createdAt, {
    id: "updated",
    header: "Updated",
    sortDescFirst: true,
    meta: { className: "w-32 text-right text-muted max-sm:hidden" },
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
      <p className="border-t border-border py-4 text-sm text-muted">
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
        rowClassName="h-12"
      />
      {status === "CanLoadMore" && (
        <div className="mt-4 flex justify-center">
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
        <div className="mt-4 flex justify-center text-muted">
          <Spinner size={16} />
        </div>
      )}
    </>
  );
}
