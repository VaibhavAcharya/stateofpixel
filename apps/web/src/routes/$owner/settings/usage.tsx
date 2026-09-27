import { api } from "@stateofpixel/backend/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppHeader } from "../../../components/AppHeader";
import { RequireAuth } from "../../../components/RequireAuth";
import { USAGE_DAYS, UsageView } from "../../../components/Usage";
import { EmptyState, Skeleton } from "../../../components/ui";
import { prefetchAccount } from "../../../lib/prefetch";

const DAY_MS = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/$owner/settings/usage")({
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  component: UsagePage,
});

function UsagePage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/usage`}>
      <AppHeader owner={owner} />
      <AccountLayout owner={owner} tab="usage">
        <Usage owner={owner} />
      </AccountLayout>
    </RequireAuth>
  );
}

function Usage({ owner }: { owner: string }) {
  const [today] = useState(() => Date.now());
  const home = useQuery(api.accounts.home, { login: owner });
  const usage = useQuery(api.usage.get, {
    login: owner,
    since: new Date(today - (USAGE_DAYS - 1) * DAY_MS)
      .toISOString()
      .slice(0, 10),
  });

  if (home?.role === "member" || (home?.role === "owner" && usage === null)) {
    return (
      <EmptyState title="Only owners can see usage.">
        Owners of {owner} on GitHub see the storage each project uses.
      </EmptyState>
    );
  }
  if (!usage) {
    return <Skeleton className="h-40" />;
  }
  return <UsageView owner={owner} usage={usage} today={today} />;
}
