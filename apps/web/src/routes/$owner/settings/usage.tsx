import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppShell } from "../../../components/AppShell";
import { RequireAuth } from "../../../components/RequireAuth";
import { USAGE_DAYS, UsageView } from "../../../components/Usage";
import { Skeleton } from "../../../components/ui";
import { api, useQuery } from "../../../lib/backend";
import { prefetchAccount } from "../../../lib/prefetch";

const DAY_MS = 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/$owner/settings/usage")({
  loader: ({ context, params }) =>
    prefetchAccount(context.queryClient, params.owner),
  component: UsagePage,
});

function UsagePage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/usage`}>
      <AppShell owner={owner} crumb="Usage">
        <AccountLayout owner={owner} tab="usage">
          <Usage owner={owner} />
        </AccountLayout>
      </AppShell>
    </RequireAuth>
  );
}

function Usage({ owner }: { owner: string }) {
  const [today] = useState(() => Date.now());
  const usage = useQuery(api.usage.get, {
    login: owner,
    since: new Date(today - (USAGE_DAYS - 1) * DAY_MS)
      .toISOString()
      .slice(0, 10),
  });

  if (!usage) {
    return <Skeleton className="h-40" />;
  }
  return <UsageView owner={owner} usage={usage} today={today} />;
}
