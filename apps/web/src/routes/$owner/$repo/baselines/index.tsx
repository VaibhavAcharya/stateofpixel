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

type Search = { suite?: string; prefix?: string };

type Suite = {
  buildName: string;
  build: { number: number; commitSha: string } | null;
};

const PAGE_SIZE = 60;

export const Route = createFileRoute("/$owner/$repo/baselines/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    suite:
      typeof search.suite === "string" && search.suite !== ""
        ? search.suite
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
  const result = useProjectAccess(owner, repo);
  const suites = useQuery(api.baselines.current, { owner, name: repo });
  if (result.state === "not_found") {
    return (
      <EmptyState title="Project not found.">
        The repository may not exist here, or you do not have access to it on
        GitHub.
      </EmptyState>
    );
  }
  if (result.state === "loading" || !suites) {
    return <SkeletonRows />;
  }
  if (suites.every((suite) => suite.build === null)) {
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
      suites={suites}
      defaultBranch={result.access.defaultBranch}
    />
  );
}

function Baselines({
  owner,
  repo,
  suites,
  defaultBranch,
}: {
  owner: string;
  repo: string;
  suites: Suite[];
  defaultBranch: string;
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const shown =
    search.suite === undefined
      ? suites.filter((suite) => suite.build !== null)
      : suites.filter((suite) => suite.buildName === search.suite);

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
        {suites.length > 1 && (
          <SelectMenu
            label="Suite"
            value={search.suite}
            options={[
              { value: undefined, label: "All" },
              ...suites.map((suite) => ({
                value: suite.buildName,
                label: suite.buildName,
              })),
            ]}
            onChange={(suite) =>
              void navigate({ search: (prev) => ({ ...prev, suite }) })
            }
          />
        )}
      </ListToolbar>
      <div className="flex flex-col gap-8">
        {shown.map((suite) =>
          suite.build === null ? (
            <p key={suite.buildName} className="py-6 text-sm text-muted">
              No baseline yet for{" "}
              <span className="mono">{suite.buildName}</span> on{" "}
              <span className="mono">{defaultBranch}</span>.
            </p>
          ) : (
            <SuiteBaselines
              key={suite.buildName}
              owner={owner}
              repo={repo}
              buildName={suite.buildName}
              build={suite.build}
              prefix={search.prefix}
              showName={suites.length > 1}
            />
          ),
        )}
      </div>
    </>
  );
}

function SuiteBaselines({
  owner,
  repo,
  buildName,
  build,
  prefix,
  showName,
}: {
  owner: string;
  repo: string;
  buildName: string;
  build: { number: number; commitSha: string };
  prefix: string | undefined;
  showName: boolean;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.baselines.list,
    { owner, name: repo, buildName, prefix },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        {showName && <h2 className="text-sm font-medium">{buildName}</h2>}
        <p className="text-xs text-muted">
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
      </div>
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
                search={{ suite: buildName }}
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
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {children}
    </ul>
  );
}
