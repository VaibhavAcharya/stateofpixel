import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { AppHeader } from "../../components/AppHeader";
import { ListToolbar, SearchField } from "../../components/ListControls";
import { Page, PageHeader } from "../../components/Page";
import { PlanBox } from "../../components/PlanBox";
import { ProjectTable } from "../../components/ProjectTable";
import { RequireAuth } from "../../components/RequireAuth";
import { StorageBanner } from "../../components/StorageBanner";
import {
  Avatar,
  accountAvatar,
  buttonClass,
  EmptyState,
} from "../../components/ui";
import { prefetchAccount } from "../../lib/prefetch";
import {
  type ProjectSearch,
  validateProjectSearch,
} from "../../lib/projectSearch";
import { useListKeys } from "../../lib/useListKeys";

export const Route = createFileRoute("/$owner/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): ProjectSearch & { subscription_id?: string; status?: string } => ({
    ...validateProjectSearch(search),
    subscription_id:
      typeof search.subscription_id === "string"
        ? search.subscription_id
        : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  component: AccountPage,
});

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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  useListKeys();

  if (home === null) {
    return (
      <Page>
        <EmptyState
          title="Account not found."
          action={
            <Link to="/install" className={buttonClass()}>
              See your accounts
            </Link>
          }
        >
          It may not have the GitHub App installed, or you are not a member.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        leading={<Avatar src={accountAvatar(owner)} size={40} square />}
        title={owner}
        meta={
          home === undefined
            ? "Loading"
            : home.type === "org"
              ? "Organization"
              : "Personal account"
        }
        actions={
          home?.installationSettingsUrl && (
            <a href={home.installationSettingsUrl} className={buttonClass()}>
              Configure on GitHub
              <ArrowUpRightIcon size={14} className="text-muted" />
            </a>
          )
        }
      />
      {home !== undefined && (
        <>
          <StorageBanner owner={owner} storage={home.storage} />
          <PlanBox
            login={owner}
            storage={home.storage}
            subscription={home.subscription}
            billingCustomer={home.billingCustomer}
            checkoutResult={
              search.subscription_id === undefined ||
              search.status === undefined
                ? null
                : {
                    subscriptionId: search.subscription_id,
                    status: search.status,
                  }
            }
            onDismissCheckout={() =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  subscription_id: undefined,
                  status: undefined,
                }),
                replace: true,
              })
            }
          />
        </>
      )}
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
      <ProjectTable
        login={owner}
        search={search}
        onSearchChange={(next) =>
          void navigate({ search: next, replace: true })
        }
        empty="No repositories yet. Pick the repositories to test in the GitHub App settings."
      />
    </Page>
  );
}
