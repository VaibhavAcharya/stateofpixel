import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import type { api, FunctionReturnType } from "../lib/backend";
import { columnHelper, DataTable } from "./DataTable";
import { PLAN_NAMES } from "./PlanBox";
import { Avatar, accountAvatar, listRowLinkClass, RelativeTime } from "./ui";

export type Account = FunctionReturnType<typeof api.me.accounts>[number];

const helper = columnHelper<Account>();

const columns = helper.columns([
  helper.accessor("login", {
    header: "Account",
    cell: ({ row }) => (
      <Link
        to="/$owner"
        params={{ owner: row.original.login }}
        data-list-row
        className={`flex min-w-0 items-center gap-2.5 ${listRowLinkClass}`}
      >
        <Avatar src={accountAvatar(row.original.login)} size={24} square />
        <span className="truncate font-medium">{row.original.login}</span>
        <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
          {row.original.installed
            ? row.original.type === "org"
              ? "Organization"
              : "Personal account"
            : "App not installed"}
        </span>
      </Link>
    ),
  }),
  helper.accessor("storage", {
    header: "Storage",
    meta: {
      className: "w-48 text-muted-foreground tabular-nums max-md:hidden",
    },
    cell: ({ row }) => {
      const { plan, storage } = row.original;
      return plan === "unlimited"
        ? `${formatGigabytes(storage.storageBytes)}, ${PLAN_NAMES[plan]}`
        : `${formatGigabytes(storage.storageBytes)} of ${formatGigabytes(storage.storageLimitBytes)}`;
    },
  }),
  helper.accessor("projects", {
    header: "Projects",
    meta: { className: "w-24 text-right tabular-nums" },
  }),
  helper.accessor("lastBuildAt", {
    header: "Last build",
    meta: { className: "w-32 text-right text-muted-foreground max-sm:hidden" },
    cell: ({ getValue }) => {
      const lastBuildAt = getValue();
      return lastBuildAt === null ? (
        "No builds yet"
      ) : (
        <RelativeTime timestamp={lastBuildAt} />
      );
    },
  }),
]);

export function AccountTable({ accounts }: { accounts: Account[] }) {
  return (
    <DataTable
      columns={columns}
      data={accounts}
      getRowId={(account) => account.login}
      sorting={[]}
      rowClassName="h-12"
    />
  );
}
