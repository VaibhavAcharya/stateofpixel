import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AccountLayout } from "../../components/AccountLayout";
import { AppHeader } from "../../components/AppHeader";
import { ListToolbar, SearchField } from "../../components/ListControls";
import { ProjectTable } from "../../components/ProjectTable";
import { RequireAuth } from "../../components/RequireAuth";
import { prefetchAccount } from "../../lib/prefetch";
import {
  type ProjectSearch,
  validateProjectSearch,
} from "../../lib/projectSearch";
import { useListKeys } from "../../lib/useListKeys";

export const Route = createFileRoute("/$owner/")({
  validateSearch: (search: Record<string, unknown>): ProjectSearch =>
    validateProjectSearch(search),
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}`}>
      <AppHeader owner={owner} />
      <AccountLayout owner={owner} tab="projects">
        <AccountProjects owner={owner} />
      </AccountLayout>
    </RequireAuth>
  );
}

function AccountProjects({ owner }: { owner: string }) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  useListKeys();

  return (
    <>
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
    </>
  );
}
