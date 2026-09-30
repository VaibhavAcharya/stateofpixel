import {
  ArrowRightIcon,
  GithubLogoIcon,
  PlusIcon,
} from "@phosphor-icons/react/ssr";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { ListToolbar, SearchField } from "../components/ListControls";
import { Page, PageHeader } from "../components/Page";
import { ProjectTable } from "../components/ProjectTable";
import { RequireAuth } from "../components/RequireAuth";
import {
  Avatar,
  accountAvatar,
  buttonClass,
  EmptyState,
  SkeletonRows,
  Spinner,
} from "../components/ui";
import { api, useAction, useMutation, useQuery } from "../lib/backend";
import { errorCode } from "../lib/errorCode";
import { validateProjectSearch } from "../lib/projectSearch";
import { useListKeys } from "../lib/useListKeys";

export const Route = createFileRoute("/install")({
  validateSearch: validateProjectSearch,
  component: Install,
});

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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const disconnectGithub = useMutation(api.connections.disconnectGithub);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useListKeys();

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    refreshAccounts({})
      .catch((reason: unknown) => {
        if (errorCode(reason) === "github_token_invalid") {
          void disconnectGithub({});
          return;
        }
        setError("Could not load your GitHub installations.");
      })
      .finally(() => setRefreshing(false));
  }, [refreshAccounts, disconnectGithub]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const installButton = installUrl !== undefined && (
    <a
      href={installUrl}
      className={buttonClass("primary")}
      data-umami-event="Install GitHub App"
    >
      <GithubLogoIcon size={16} weight="fill" />
      Install on GitHub
    </a>
  );

  return (
    <Page>
      <PageHeader
        title="All projects"
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
            <a
              href={installUrl}
              className={buttonClass()}
              data-umami-event="Install GitHub App"
            >
              <PlusIcon size={14} />
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
      {accounts !== undefined && accounts.length > 0 && (
        <ListToolbar>
          <SearchField
            value={search.q ?? ""}
            onChange={(q) =>
              void navigate({
                search: (prev) => ({ ...prev, q: q || undefined }),
                replace: true,
              })
            }
            placeholder="Search projects"
          />
        </ListToolbar>
      )}
      <div className="flex flex-col gap-10">
        {accounts?.map((account) => (
          <section key={account.login}>
            <div className="mb-2 flex h-8 items-center gap-2.5">
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
                <ArrowRightIcon size={12} />
              </Link>
            </div>
            <ProjectTable
              login={account.login}
              search={search}
              onSearchChange={(next) =>
                void navigate({ search: next, replace: true })
              }
              empty="No repositories selected for this account."
            />
          </section>
        ))}
      </div>
    </Page>
  );
}
