import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { createFileRoute } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppHeader } from "../../../components/AppHeader";
import { columnHelper, DataTable } from "../../../components/DataTable";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  Avatar,
  buttonClass,
  RelativeTime,
  SkeletonRows,
} from "../../../components/ui";
import { prefetchAccount } from "../../../lib/prefetch";

export const Route = createFileRoute("/$owner/settings/members")({
  loader: ({ context, params }) =>
    prefetchAccount(context.convex, params.owner),
  component: MembersPage,
});

type Member = NonNullable<FunctionReturnType<typeof api.members.list>>[number];

const ROLE_LABELS = {
  org: { owner: "Owner", member: "Member" },
  user: { owner: "Owner", member: "Collaborator" },
} as const;

const helper = columnHelper<Member>();

function memberColumns(accountType: "user" | "org") {
  return helper.columns([
    helper.accessor("login", {
      header: "Member",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar src={row.original.image} size={24} />
          <span className="truncate font-medium">
            {row.original.name ?? row.original.login}
          </span>
          {row.original.name !== null && (
            <span className="truncate text-muted max-sm:hidden">
              @{row.original.login}
            </span>
          )}
        </span>
      ),
    }),
    helper.accessor("role", {
      header: "Role",
      meta: { className: "w-32" },
      cell: ({ row }) =>
        row.original.role !== null &&
        ROLE_LABELS[accountType][row.original.role],
    }),
    helper.accessor("lastSeenAt", {
      header: "Last signed in",
      meta: { className: "w-40 text-right text-muted max-sm:hidden" },
      cell: ({ row }) => <RelativeTime timestamp={row.original.lastSeenAt} />,
    }),
  ]);
}

function MembersPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/members`}>
      <AppHeader owner={owner} />
      <AccountLayout owner={owner} tab="members">
        <Members owner={owner} />
      </AccountLayout>
    </RequireAuth>
  );
}

function Members({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  const members = useQuery(api.members.list, { login: owner });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-4">
        <p className="max-w-[65ch] text-sm text-muted">
          Everyone here has signed in to stateofpixel and has access to {owner}{" "}
          on GitHub. Access comes from GitHub, so add or remove people there.
          Owners change the plan and billing, and repository permissions decide
          who can review builds and change project settings.
        </p>
        {home?.type === "org" && (
          <a
            href={`https://github.com/orgs/${owner}/people`}
            className={buttonClass()}
          >
            Manage people on GitHub
            <ArrowUpRightIcon size={14} className="text-muted" />
          </a>
        )}
      </div>
      {home === undefined || members === undefined || members === null ? (
        <SkeletonRows rows={3} />
      ) : (
        <DataTable
          columns={memberColumns(home?.type ?? "org")}
          data={members}
          getRowId={(member) => member.login}
          sorting={[]}
        />
      )}
    </>
  );
}
