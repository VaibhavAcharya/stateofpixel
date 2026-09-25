import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex-helpers/react/cache/hooks";
import type { ReactNode } from "react";
import { AppHeader } from "../../../../components/AppHeader";
import {
  ListToolbar,
  SearchField,
  SelectMenu,
} from "../../../../components/ListControls";
import { Page } from "../../../../components/Page";
import { ProjectHeader } from "../../../../components/ProjectHeader";
import { RequireAuth } from "../../../../components/RequireAuth";
import {
  buttonClass,
  EmptyState,
  Skeleton,
  SkeletonRows,
  Spinner,
} from "../../../../components/ui";
import { shortSha } from "../../../../lib/format";
import { useProjectAccess } from "../../../../lib/useProjectAccess";

type Search = { build?: string; prefix?: string };

const PAGE_SIZE = 60;

export const Route = createFileRoute("/$owner/$repo/baselines/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    build:
      typeof search.build === "string" && search.build !== ""
        ? search.build
        : undefined,
    prefix:
      typeof search.prefix === "string" && search.prefix !== ""
        ? search.prefix
        : undefined,
  }),
  component: BaselinesRoute,
});

function BaselinesRoute() {
  const { owner, repo } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/${repo}/baselines`}>
      <AppHeader owner={owner} repo={repo} />
      <Page>
        <ProjectHeader owner={owner} repo={repo} tab="baselines" />
        <BaselinesAccess owner={owner} repo={repo} />
      </Page>
    </RequireAuth>
  );
}

function BaselinesAccess({ owner, repo }: { owner: string; repo: string }) {
  const search = Route.useSearch();
  const result = useProjectAccess(owner, repo);
  const current = useQuery(api.baselines.current, {
    owner,
    name: repo,
    buildName: search.build,
  });
  if (result.state === "not_found") {
    return (
      <EmptyState title="Project not found.">
        The repository may not exist here, or you do not have access to it on
        GitHub.
      </EmptyState>
    );
  }
  if (result.state === "loading" || !current) {
    return <SkeletonRows />;
  }
  if (current.build === null) {
    return (
      <EmptyState title="No baseline yet.">
        Baselines come from approved builds on{" "}
        <span className="mono">{result.access.defaultBranch}</span>. Merge a
        change or push to {result.access.defaultBranch} to create one.
      </EmptyState>
    );
  }
  return (
    <Baselines
      owner={owner}
      repo={repo}
      buildNames={current.buildNames}
      buildName={current.buildName}
      build={current.build}
    />
  );
}

function Baselines({
  owner,
  repo,
  buildNames,
  buildName,
  build,
}: {
  owner: string;
  repo: string;
  buildNames: string[];
  buildName: string;
  build: { number: number; commitSha: string };
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { results, status, loadMore } = usePaginatedQuery(
    api.baselines.list,
    { owner, name: repo, buildName, prefix: search.prefix },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <>
      <ListToolbar>
        <SearchField
          value={search.prefix ?? ""}
          placeholder="Name starts with"
          onChange={(prefix) =>
            void navigate({
              search: (prev) => ({ ...prev, prefix: prefix || undefined }),
            })
          }
        />
        {buildNames.length > 1 && (
          <SelectMenu
            label="Build"
            value={buildName}
            options={buildNames.map((name) => ({ value: name, label: name }))}
            onChange={(next) =>
              void navigate({ search: (prev) => ({ ...prev, build: next }) })
            }
          />
        )}
        <p className="ml-auto text-xs text-muted">
          From build{" "}
          <Link
            to="/$owner/$repo/builds/$number"
            params={{ owner, repo, number: String(build.number) }}
            className="text-text tabular-nums hover:text-link"
          >
            #{build.number}
          </Link>{" "}
          at <span className="mono">{shortSha(build.commitSha)}</span>
        </p>
      </ListToolbar>
      {status === "LoadingFirstPage" ? (
        <Grid>
          {Array.from({ length: 8 }, (_, index) => `tile-${index}`).map(
            (key) => (
              <li key={key}>
                <Skeleton className="aspect-[4/3] w-full" />
              </li>
            ),
          )}
        </Grid>
      ) : results.length === 0 ? (
        <p className="py-6 text-sm text-muted">No snapshots match.</p>
      ) : (
        <Grid>
          {results.map((snapshot) => (
            <li key={snapshot.name}>
              <Link
                to="/$owner/$repo/baselines/$"
                params={{ owner, repo, _splat: snapshot.name }}
                search={{ build: buildName }}
                title={snapshot.name}
                className="group flex flex-col gap-2"
              >
                <span
                  className="block w-full overflow-hidden rounded-sm bg-surface-2 group-hover:outline group-hover:outline-1 group-hover:outline-field-border"
                  style={{
                    aspectRatio:
                      snapshot.image === null
                        ? "4 / 3"
                        : `${snapshot.image.width} / ${Math.min(
                            snapshot.image.height,
                            (snapshot.image.width * 3) / 4,
                          )}`,
                  }}
                >
                  {snapshot.image && (
                    <img
                      src={snapshot.image.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-contain object-top"
                    />
                  )}
                </span>
                <span className="mono truncate text-xs">{snapshot.name}</span>
              </Link>
            </li>
          ))}
        </Grid>
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

function Grid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {children}
    </ul>
  );
}
