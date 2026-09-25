import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { RequireAuth } from "../components/RequireAuth";
import { buttonClass, LeadCopy } from "../components/ui";

export const Route = createFileRoute("/install")({ component: Install });

function Install() {
  return (
    <RequireAuth redirectTo="/install">
      <AppHeader />
      <main className="max-w-[1200px] px-6 pt-6 pb-12 max-sm:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.025em]">Projects</h1>
        <Accounts />
      </main>
    </RequireAuth>
  );
}

function Accounts() {
  const accounts = useQuery(api.me.accounts);
  const installUrl = useQuery(api.me.installUrl);
  const refreshAccounts = useAction(api.me.refreshAccounts);
  const { signOut } = useAuthActions();
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshAccounts({})
      .catch((reason: unknown) => {
        if (
          reason instanceof ConvexError &&
          reason.data?.code === "github_token_invalid"
        ) {
          void signOut();
          return;
        }
        setError("Could not load your GitHub installations.");
      })
      .finally(() => setRefreshing(false));
  }, [refreshAccounts, signOut]);

  return (
    <div className="mt-6 max-w-2xl">
      {error !== null && <p className="text-sm text-failed">{error}</p>}
      {accounts?.length === 0 && !refreshing && (
        <LeadCopy title="No projects yet.">
          Install the GitHub App on an account and pick the repositories to
          test.
        </LeadCopy>
      )}
      {accounts?.map((account) => (
        <section key={account.login} className="mt-6">
          <h2 className="text-sm font-medium text-muted">
            <Link
              to="/$owner"
              params={{ owner: account.login }}
              className="hover:text-text"
            >
              {account.login}
            </Link>
            {!account.installed && " (app not installed)"}
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {account.projects.map((project) => (
              <li key={project.name} className="text-sm">
                <Link
                  to="/$owner/$repo"
                  params={{ owner: project.owner, repo: project.name }}
                  className="flex h-10 items-center px-3 hover:bg-hover"
                >
                  {project.owner}/{project.name}
                  {project.private && (
                    <span className="ml-2 text-xs text-muted">private</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {refreshing && (
        <p className="mt-6 text-sm text-muted">
          Checking your GitHub installations...
        </p>
      )}
      {installUrl !== undefined && (
        <a href={installUrl} className={`mt-6 ${buttonClass("primary")}`}>
          Install on GitHub
        </a>
      )}
    </div>
  );
}
