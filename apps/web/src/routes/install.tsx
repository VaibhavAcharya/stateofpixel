import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  Authenticated,
  Unauthenticated,
  useAction,
  useQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { SignIn } from "../components/SignIn";

export const Route = createFileRoute("/install")({ component: Install });

function Install() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Projects</h1>
      <Unauthenticated>
        <SignIn redirectTo="/install" />
      </Unauthenticated>
      <Authenticated>
        <Accounts />
      </Authenticated>
    </main>
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
      {error !== null && <p className="text-sm text-red-700">{error}</p>}
      {accounts?.length === 0 && !refreshing && (
        <p className="text-2xl leading-[34px] text-neutral-500">
          <strong className="font-semibold text-neutral-900">
            No projects yet.
          </strong>{" "}
          Install the GitHub App on an account and pick the repositories to
          test.
        </p>
      )}
      {accounts?.map((account) => (
        <section key={account.login} className="mt-6">
          <h2 className="text-sm font-medium text-neutral-500">
            {account.login}
            {!account.installed && " (app not installed)"}
          </h2>
          <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200">
            {account.projects.map((project) => (
              <li key={project.name} className="py-2 text-sm">
                {project.owner}/{project.name}
                {project.private && (
                  <span className="ml-2 text-xs text-neutral-500">private</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {refreshing && (
        <p className="mt-6 text-sm text-neutral-500">
          Checking your GitHub installations...
        </p>
      )}
      {installUrl !== undefined && (
        <a
          href={installUrl}
          className="mt-6 inline-flex h-8 items-center rounded-[11px] bg-neutral-900 px-3 text-sm font-medium text-white"
        >
          Install on GitHub
        </a>
      )}
    </div>
  );
}
