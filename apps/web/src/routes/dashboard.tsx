import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { Page } from "../components/Page";
import { RequireAuth } from "../components/RequireAuth";
import { SkeletonRows } from "../components/ui";
import { api, useAction, useQuery } from "../lib/backend";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <RequireAuth redirectTo="/dashboard">
      <OpenDashboard />
    </RequireAuth>
  );
}

function OpenDashboard() {
  const refreshAccounts = useAction(api.me.refreshAccounts);
  const accounts = useQuery(api.me.accounts);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    refreshAccounts({})
      .catch(() => null)
      .then(() => setRefreshed(true));
  }, [refreshAccounts]);

  if (!refreshed || accounts === undefined) {
    return (
      <>
        <AppHeader />
        <Page>
          <SkeletonRows rows={3} />
        </Page>
      </>
    );
  }
  const [only] = accounts;
  if (accounts.length === 1 && only !== undefined) {
    return <Navigate to="/$owner" params={{ owner: only.login }} replace />;
  }
  return <Navigate to="/install" replace />;
}
