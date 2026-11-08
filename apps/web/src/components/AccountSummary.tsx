import { STORAGE_WARNING_SHARE } from "@stateofpixel/backend/limits";
import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { api, useQuery } from "../lib/backend";
import { PLAN_NAMES } from "./PlanBox";
import { AvatarStack, Skeleton } from "./ui";

export function AccountSummary({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  const members = useQuery(api.members.list, { login: owner });

  if (!home) {
    return <Skeleton className="mb-6 h-24" />;
  }
  const { storage } = home;
  const unlimited = storage.plan === "unlimited";
  return (
    <div className="mb-6 grid grid-cols-3 divide-x divide-border rounded-xl border bg-card shadow-xs/5 max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
      <SummaryCell
        label="Plan"
        to="/$owner/settings/billing"
        owner={owner}
        link="Billing"
      >
        {PLAN_NAMES[storage.plan]}
      </SummaryCell>
      <SummaryCell
        label="Storage"
        to="/$owner/settings/usage"
        owner={owner}
        link="Usage"
      >
        {formatGigabytes(storage.storageBytes)}
        {!unlimited && (
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            of {formatGigabytes(storage.storageLimitBytes)}
          </span>
        )}
        {!unlimited && (
          <span
            aria-hidden
            className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={`block h-full rounded-full ${
                storage.storageBytes >=
                storage.storageLimitBytes * STORAGE_WARNING_SHARE
                  ? "bg-changed"
                  : "bg-foreground/48"
              }`}
              style={{
                width: `${Math.min(100, (storage.storageBytes / storage.storageLimitBytes) * 100)}%`,
              }}
            />
          </span>
        )}
      </SummaryCell>
      <SummaryCell
        label="Members"
        to="/$owner/settings/members"
        owner={owner}
        link="Members"
      >
        <span className="flex items-center gap-3">
          {members ? members.length : "-"}
          {members && (
            <AvatarStack people={members.slice(0, 5)} total={members.length} />
          )}
        </span>
      </SummaryCell>
    </div>
  );
}

function SummaryCell({
  label,
  to,
  owner,
  link,
  children,
}: {
  label: string;
  to: string;
  owner: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Link to={to} params={{ owner }} className="text-link">
          {link}
        </Link>
      </div>
      <div className="font-heading font-semibold text-xl tabular-nums">
        {children}
      </div>
    </div>
  );
}
