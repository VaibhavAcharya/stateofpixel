import { useAuthActions } from "@convex-dev/auth/react";
import {
  ArrowRight,
  GithubLogo,
  LockSimple,
  Plus,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useState } from "react";
import { AppHeader, accountAvatar } from "../components/AppHeader";
import { Page, PageHeader } from "../components/Page";
import { RequireAuth } from "../components/RequireAuth";
import {
  Avatar,
  buttonClass,
  EmptyState,
  SkeletonRows,
  Spinner,
} from "../components/ui";

export const Route = createFileRoute("/install")({ component: Install });

function Install() {
  return (
    <RequireAuth redirectTo="/install">
      <AppHeader />
      <Accounts />
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

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const installButton = installUrl !== undefined && (
    <a href={installUrl} className={buttonClass("primary")}>
      <GithubLogo size={16} weight="fill" />
      Install on GitHub
    </a>
  );

  return (
    <Page>
      <PageHeader
        title="Projects"
        meta={
          refreshing ? (
            <span className="flex items-center gap-1.5">
              <Spinner size={12} />
              Checking your GitHub installations
            </span>
          ) : (
            "Every repository the GitHub App can see"
          )
        }
        actions={
          accounts !== undefined &&
          accounts.length > 0 &&
          installUrl !== undefined && (
            <a href={installUrl} className={buttonClass()}>
              <Plus size={14} />
              Add account
            </a>
          )
        }
      />
      {error !== null && (
        <p className="mb-6 flex items-center gap-3 rounded-md bg-failed-bg px-3 py-2 text-sm">
          {error}
          <button
            type="button"
            className="font-medium text-link"
            onClick={refresh}
          >
            Try again
          </button>
        </p>
      )}
      {accounts === undefined && <SkeletonRows rows={3} />}
      {accounts?.length === 0 && !refreshing && (
        <EmptyState
          title="No projects yet."
          action={
            <div className="flex flex-wrap items-center gap-3">
              {installButton}
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={refresh}
              >
                Already installed? Refresh
              </button>
            </div>
          }
        >
          Install the GitHub App on an account and pick the repositories to
          test.
        </EmptyState>
      )}
      <div className="flex flex-col gap-10">
        {accounts?.map((account) => (
          <section key={account.login}>
            <div className="flex h-10 items-center gap-2.5 border-b border-border">
              <Avatar src={accountAvatar(account.login)} size={20} square />
              <h2 className="text-sm font-medium">{account.login}</h2>
              {!account.installed && (
                <span className="text-xs text-muted">App not installed</span>
              )}
              <Link
                to="/$owner"
                params={{ owner: account.login }}
                className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-text"
              >
                Overview
                <ArrowRight size={12} />
              </Link>
            </div>
            {account.projects.length === 0 ? (
              <p className="py-3 text-sm text-muted">
                No repositories selected for this account.
              </p>
            ) : (
              <ul>
                {account.projects.map((project) => (
                  <li
                    key={project.name}
                    className="border-b border-border text-sm"
                  >
                    <Link
                      to="/$owner/$repo"
                      params={{ owner: project.owner, repo: project.name }}
                      className="group flex h-11 items-center gap-2 px-3 transition-colors duration-100 hover:bg-hover"
                    >
                      <span className="text-muted">{project.owner} /</span>
                      <span className="font-medium">{project.name}</span>
                      {project.private && (
                        <LockSimple
                          size={12}
                          aria-label="Private"
                          className="text-muted"
                        />
                      )}
                      <ArrowRight
                        size={14}
                        className="ml-auto text-subtle opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Page>
  );
}
