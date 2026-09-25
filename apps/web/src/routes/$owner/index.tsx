import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AppHeader } from "../../components/AppHeader";
import { RequireAuth } from "../../components/RequireAuth";
import {
  BuildStatePill,
  LeadCopy,
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

  return (
    <main className="max-w-[1200px] px-6 pt-6 pb-12 max-sm:px-4">
      <h1 className="text-xl font-semibold tracking-[-0.025em]">Projects</h1>
      <div className="mt-6">
        {home === undefined && <SkeletonRows />}
        {home === null && (
          <LeadCopy title="Account not found.">
            It may not have the GitHub App installed, or you are not a member.{" "}
            <Link to="/install" className="text-link">
              See your accounts
            </Link>
            .
          </LeadCopy>
        )}
        {home && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="h-8 border-b border-border text-left text-2xs font-medium text-muted">
                  <th className="px-3 font-medium">Project</th>
                  <th className="px-3 text-right font-medium">Build</th>
                  <th className="px-3 font-medium max-sm:hidden">Branch</th>
                  <th className="px-3 font-medium">Status</th>
                  <th className="px-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {home.projects.map((project) => (
                  <tr
                    key={project.name}
                    className="relative h-10 border-b border-border hover:bg-hover"
                  >
                    <td className="px-3 font-medium">
                      <Link
                        to="/$owner/$repo"
                        params={{ owner: project.owner, repo: project.name }}
                        className="after:absolute after:inset-0"
                      >
                        {project.name}
                      </Link>
                    </td>
                    {project.latestBuild === null ? (
                      <td colSpan={4} className="px-3 text-muted">
                        no builds yet
                      </td>
                    ) : (
                      <>
                        <td className="px-3 text-right tabular-nums">
                          #{project.latestBuild.number}
                        </td>
                        <td className="px-3 font-mono max-sm:hidden">
                          {project.latestBuild.branch}
                        </td>
                        <td className="px-3">
                          <BuildStatePill
                            status={project.latestBuild.status}
                            conclusion={project.latestBuild.conclusion}
                            counts={project.latestBuild.counts}
                            shards={{ done: 0, total: null }}
                          />
                        </td>
                        <td className="px-3 text-right text-muted tabular-nums">
                          <RelativeTime
                            timestamp={project.latestBuild.createdAt}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {home.installationSettingsUrl && (
              <p className="mt-6 text-sm text-muted">
                Missing a repo?{" "}
                <a href={home.installationSettingsUrl} className="text-link">
                  Configure access on GitHub
                </a>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
