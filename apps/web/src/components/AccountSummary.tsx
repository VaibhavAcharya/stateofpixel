import { formatGigabytes } from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { api, useQuery } from "../lib/backend";
import { PLAN_NAMES } from "./PlanBox";
import { Skeleton } from "./ui";

export function AccountSummary({ owner }: { owner: string }) {
  const home = useQuery(api.accounts.home, { login: owner });
  const members = useQuery(api.members.list, { login: owner });

  if (!home) {
    return <Skeleton className="mb-6 h-21" />;
  }
  const { storage } = home;
  const unlimited = storage.plan === "unlimited";
  return (
    <div className="mb-6 grid grid-cols-3 divide-x divide-border rounded-lg bg-surface ring-1 ring-border max-sm:grid-cols-1 max-sm:divide-x-0 max-sm:divide-y">
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
          <span className="text-sm font-normal text-muted">
            {" "}
            of {formatGigabytes(storage.storageLimitBytes)}
          </span>
        )}
      </SummaryCell>
      <SummaryCell
        label="Members"
        to="/$owner/settings/members"
        owner={owner}
        link="Members"
      >
        {members ? members.length : "-"}
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
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between text-xs text-muted">
        {label}
        <Link to={to} params={{ owner }} className="text-link">
          {link}
        </Link>
      </div>
      <div className="text-lg font-semibold tabular-nums">{children}</div>
    </div>
  );
}
