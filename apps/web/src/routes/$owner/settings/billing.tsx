import { api } from "@stateofpixel/backend/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppHeader } from "../../../components/AppHeader";
import { PlanBox } from "../../../components/PlanBox";
import { RequireAuth } from "../../../components/RequireAuth";
import { Skeleton } from "../../../components/ui";
import { prefetchAccount } from "../../../lib/prefetch";

export const Route = createFileRoute("/$owner/settings/billing")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { subscription_id?: string; status?: string } => ({
    subscription_id:
      typeof search.subscription_id === "string"
        ? search.subscription_id
        : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  component: BillingPage,
});

function BillingPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/billing`}>
      <AppHeader owner={owner} />
      <AccountLayout owner={owner} tab="billing">
        <Billing owner={owner} />
      </AccountLayout>
    </RequireAuth>
  );
}

function Billing({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  if (!home) {
    return <Skeleton className="h-15" />;
  }
  return (
    <PlanBox
      login={owner}
      accountType={home.type}
      storage={home.storage}
      subscription={home.subscription}
      billingCustomer={home.billingCustomer}
      role={home.role}
      checkoutResult={
        search.subscription_id === undefined || search.status === undefined
          ? null
          : { subscriptionId: search.subscription_id, status: search.status }
      }
      onDismissCheckout={() =>
        void navigate({
          search: { subscription_id: undefined, status: undefined },
          replace: true,
        })
      }
    />
  );
}
