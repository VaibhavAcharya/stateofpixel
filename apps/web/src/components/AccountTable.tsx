import { STORAGE_WARNING_SHARE } from "@stateofpixel/backend/limits";
import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import type { api, FunctionReturnType } from "../lib/backend";
import { columnHelper, DataTable } from "./DataTable";
import { PLAN_NAMES } from "./PlanBox";
import {
  Avatar,
  AvatarStack,
  accountAvatar,
  listRowLinkClass,
  RelativeTime,
} from "./ui";

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
        className={`flex min-w-0 items-center gap-3 ${listRowLinkClass}`}
      >
        <Avatar src={accountAvatar(row.original.login)} size={32} square />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.login}</span>
          <span className="truncate text-muted-foreground text-xs">
            {row.original.installed
              ? `${row.original.type === "org" ? "Organization" : "Personal account"}, ${PLAN_NAMES[row.original.plan]} plan`
              : "App not installed"}
          </span>
        </span>
      </Link>
    ),
  }),
  helper.accessor("members", {
    header: "Members",
    meta: { className: "w-36 max-md:hidden" },
    cell: ({ getValue }) => {
      const { count, faces } = getValue();
      return <AvatarStack people={faces} total={count} />;
    },
  }),
  helper.accessor("storage", {
    header: "Storage",
    meta: {
      className: "w-48 text-muted-foreground tabular-nums max-md:hidden",
    },
    cell: ({ row }) => {
      const { plan, storage } = row.original;
      if (plan === "unlimited") {
        return `${formatGigabytes(storage.storageBytes)}, ${PLAN_NAMES[plan]}`;
      }
      const used = Math.min(
        1,
        storage.storageBytes / storage.storageLimitBytes,
      );
      return (
        <span className="flex flex-col gap-1.5">
          <span>
            <span className="text-foreground">
              {formatGigabytes(storage.storageBytes)}
            </span>{" "}
            of {formatGigabytes(storage.storageLimitBytes)}
          </span>
          <span
            aria-hidden
            className="h-1 w-full max-w-36 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={`block h-full rounded-full ${used >= STORAGE_WARNING_SHARE ? "bg-changed" : "bg-foreground/48"}`}
              style={{ width: `${used * 100}%` }}
            />
          </span>
        </span>
      );
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
      rowClassName="h-16"
    />
  );
}
