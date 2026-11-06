import { GithubLogoIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AccountTable } from "../components/AccountTable";
import { AppHeader } from "../components/AppHeader";
import { Page, PageHeader } from "../components/Page";
import { RequireAuth } from "../components/RequireAuth";
import {
  buttonClass,
  EmptyState,
  SkeletonRows,
  Spinner,
} from "../components/ui";
import { api, useAction, useQuery } from "../lib/backend";
import { errorCode } from "../lib/errorCode";
import { useDisconnectExpiredGithub } from "../lib/useDisconnectExpiredGithub";
import { useListKeys } from "../lib/useListKeys";

export const Route = createFileRoute("/install")({
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
  const disconnectGithub = useDisconnectExpiredGithub();
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useListKeys();

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    refreshAccounts({})
      .catch((reason: unknown) => {
        if (errorCode(reason) === "github_token_invalid") {
          void disconnectGithub();
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
        title="Accounts"
        meta={
          refreshing ? (
            <span className="flex items-center gap-1.5">
              <Spinner size={12} />
              Checking your GitHub installations
            </span>
          ) : (
            "Every GitHub account with the app installed that you can see"
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
          title="No accounts yet."
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
        <AccountTable accounts={accounts} />
      )}
    </Page>
  );
}
