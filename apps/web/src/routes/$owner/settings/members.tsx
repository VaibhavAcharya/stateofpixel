import { ArrowUpRightIcon, CrownSimpleIcon } from "@phosphor-icons/react/ssr";
import { createFileRoute } from "@tanstack/react-router";
import { Badge, Button } from "uiofcraft";
import { AccountLayout } from "../../../components/AccountLayout";
import { AppShell } from "../../../components/AppShell";
import { columnHelper, DataTable } from "../../../components/DataTable";
import { RequireAuth } from "../../../components/RequireAuth";
import {
  Avatar,
  AvatarStack,
  RelativeTime,
  SkeletonRows,
} from "../../../components/ui";
import { api, type FunctionReturnType, useQuery } from "../../../lib/backend";
import { formatCount } from "../../../lib/format";
import { prefetchAccount } from "../../../lib/prefetch";

export const Route = createFileRoute("/$owner/settings/members")({
  loader: ({ context, params }) =>
    prefetchAccount(context.queryClient, params.owner),
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
        <span className="flex min-w-0 items-center gap-3">
          <Avatar src={row.original.image} size={32} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {row.original.name ?? row.original.login}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              @{row.original.login}
            </span>
          </span>
        </span>
      ),
    }),
    helper.accessor("role", {
      header: "Role",
      meta: { className: "w-32" },
      cell: ({ row }) =>
        row.original.role !== null && (
          <Badge
            variant={row.original.role === "owner" ? "secondary" : "outline"}
            className={
              row.original.role === "owner"
                ? undefined
                : "text-muted-foreground"
            }
          >
            {row.original.role === "owner" && <CrownSimpleIcon />}
            {ROLE_LABELS[accountType][row.original.role]}
          </Badge>
        ),
    }),
    helper.accessor("lastSeenAt", {
      header: "Last active",
      meta: {
        className: "w-40 text-right text-muted-foreground max-sm:hidden",
      },
      cell: ({ row }) => <RelativeTime timestamp={row.original.lastSeenAt} />,
    }),
  ]);
}

function MembersPage() {
  const { owner } = Route.useParams();
  return (
    <RequireAuth redirectTo={`/${owner}/settings/members`}>
      <AppShell owner={owner} crumb="Members">
        <AccountLayout owner={owner} tab="members">
          <Members owner={owner} />
        </AccountLayout>
      </AppShell>
    </RequireAuth>
  );
}

function Members({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  const members = useQuery(api.members.list, { login: owner });
  const owners =
    members?.filter((member) => member.role === "owner").length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-4">
        <p className="max-w-[65ch] text-sm text-muted-foreground">
          Everyone here has signed in to stateofpixel and has access to {owner}{" "}
          on GitHub. Access comes from GitHub, so add or remove people there.
          Owners change the plan and billing, and repository permissions decide
          who can review builds and change project settings.
        </p>
        {home?.type === "org" && (
          <Button
            variant="outline"
            render={<a href={`https://github.com/orgs/${owner}/people`} />}
          >
            Manage people on GitHub
            <ArrowUpRightIcon size={14} className="text-muted-foreground" />
          </Button>
        )}
      </div>
      {home === undefined || members === undefined || members === null ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 text-muted-foreground text-sm">
            <AvatarStack people={members.slice(0, 6)} total={members.length} />
            <span>
              {members.length === 1
                ? "1 member"
                : `${formatCount(members.length)} members`}
              {", "}
              {owners === 1 ? "1 owner" : `${formatCount(owners)} owners`}
            </span>
          </div>
          <DataTable
            columns={memberColumns(home?.type ?? "org")}
            data={members}
            getRowId={(member) => member.login}
            sorting={[]}
            rowClassName="h-16"
          />
        </>
      )}
    </>
  );
}
