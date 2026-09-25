import { ArrowUpRightIcon, LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AppHeader, accountAvatar } from "../../components/AppHeader";
import { Page, PageHeader } from "../../components/Page";
import { RequireAuth } from "../../components/RequireAuth";
import {
  Avatar,
  BuildStatePill,
  buttonClass,
  EmptyState,
  RelativeTime,
  SkeletonRows,
} from "../../components/ui";

export const Route = createFileRoute("/$owner/")({ component: AccountPage });

function AccountPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}`}>
      <AppHeader owner={owner} />
      <AccountHome owner={owner} />
    </RequireAuth>
  );
}

function AccountHome({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });

  if (home === null) {
    return (
      <Page>
        <EmptyState
          title="Account not found."
          action={
            <Link to="/install" className={buttonClass()}>
              See your accounts
            </Link>
          }
        >
          It may not have the GitHub App installed, or you are not a member.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        leading={<Avatar src={accountAvatar(owner)} size={40} square />}
        title={owner}
        meta={
          home === undefined
            ? "Loading projects"
            : `${home.projects.length} ${home.projects.length === 1 ? "project" : "projects"}`
        }
        actions={
          home?.installationSettingsUrl && (
            <a href={home.installationSettingsUrl} className={buttonClass()}>
              Configure on GitHub
              <ArrowUpRightIcon size={14} className="text-muted" />
            </a>
          )
        }
      />
      {home === undefined ? (
        <SkeletonRows rows={4} />
      ) : home.projects.length === 0 ? (
        <EmptyState title="No repositories yet.">
          Pick the repositories to test in the GitHub App settings.
        </EmptyState>
      ) : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="h-8 border-b border-border text-left text-2xs font-medium text-muted">
              <th className="px-3 font-medium">Project</th>
              <th className="w-44 px-3 font-medium max-sm:w-32">
                Latest build
              </th>
              <th className="w-56 px-3 font-medium max-md:hidden">Branch</th>
              <th className="w-32 px-3 text-right font-medium max-sm:w-24">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {home.projects.map((project) => (
              <tr
                key={project.name}
                className="relative h-12 border-b border-border transition-colors duration-100 hover:bg-hover"
              >
                <td className="px-3">
                  <Link
                    to="/$owner/$repo"
                    params={{ owner: project.owner, repo: project.name }}
                    className="flex min-w-0 items-center gap-2 font-medium after:absolute after:inset-0"
                  >
                    <span className="truncate">{project.name}</span>
                    {project.private && (
                      <LockSimpleIcon
                        size={12}
                        aria-label="Private"
                        className="shrink-0 text-muted"
                      />
                    )}
                  </Link>
                </td>
                {project.latestBuild === null ? (
                  <td colSpan={3} className="px-3 text-muted">
                    No builds yet
                  </td>
                ) : (
                  <>
                    <td className="px-3">
                      <span className="flex items-center gap-2">
                        <span className="text-muted tabular-nums">
                          #{project.latestBuild.number}
                        </span>
                        <BuildStatePill
                          status={project.latestBuild.status}
                          conclusion={project.latestBuild.conclusion}
                          counts={project.latestBuild.counts}
                          shards={{ done: 0, total: null }}
                        />
                      </span>
                    </td>
                    <td className="truncate px-3 max-md:hidden">
                      <span className="mono">{project.latestBuild.branch}</span>
                    </td>
                    <td className="px-3 text-right text-muted">
                      <RelativeTime timestamp={project.latestBuild.createdAt} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}
