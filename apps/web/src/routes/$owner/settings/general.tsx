import { api } from "@stateofpixel/backend/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppHeader } from "../../../components/AppHeader";
import { ImageStorage } from "../../../components/ImageStorage";
import { RequireAuth } from "../../../components/RequireAuth";
import { EmptyState, SkeletonRows } from "../../../components/ui";
import { prefetchAccount } from "../../../lib/prefetch";

export const Route = createFileRoute("/$owner/settings/general")({
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  component: SettingsPage,
});

function SettingsPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/general`}>
      <AppHeader owner={owner} />
      <AccountLayout owner={owner} tab="settings">
        <Settings owner={owner} />
      </AccountLayout>
    </RequireAuth>
  );
}

function Settings({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  if (!home) {
    return <SkeletonRows />;
  }
  if (home.role !== "owner") {
    return (
      <EmptyState title="Only owners can change settings.">
        Owners of {owner} on GitHub pick where the account's images are stored.
      </EmptyState>
    );
  }
  return (
    <div className="flex max-w-[640px] flex-col">
      <ImageStorage login={owner} value={home.imageStore} />
    </div>
  );
}
