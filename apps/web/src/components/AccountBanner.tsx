import { InfoIcon, WarningIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import {
  formatGigabytes,
  graceEndsAt,
  PLAN_STORAGE_LIMIT_BYTES,
  type StorageUsage,
} from "@stateofpixel/backend/storage";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { ReactNode } from "react";
import {
  type AccountAlert,
  accountAlert,
  type Subscription,
} from "../lib/accountAlert";
import { formatDate } from "../lib/format";
import { SUPPORT_EMAIL } from "../lib/supportEmail";
import { PLAN_NAMES } from "./PlanBox";

const LINK_CLASS = "font-medium text-link";

const TONES = {
  warning: { box: "bg-changed-bg", icon: "text-changed", Icon: WarningIcon },
  error: { box: "bg-failed-bg", icon: "text-failed", Icon: WarningIcon },
  info: { box: "bg-pending-bg", icon: "text-pending", Icon: InfoIcon },
} as const;

export type BannerAccount = {
  type: "user" | "org";
  role: "owner" | "member" | null;
  storage: StorageUsage & { plan: keyof typeof PLAN_NAMES };
  subscription: Subscription | null;
};

export function AccountBanner({
  owner,
  account,
  repo,
}: {
  owner: string;
  account: BannerAccount;
  repo?: { name: string; canAdmin: boolean };
}) {
  const billingAvailable = useQuery(api.billing.available);
  const alert = accountAlert(account.storage, account.subscription, Date.now());
  if (alert === null) {
    return null;
  }
  const { box, icon, Icon } = TONES[tone(alert)];
  return (
    <p
      className={`mb-6 flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm ${box}`}
    >
      <Icon size={16} className={`shrink-0 ${icon}`} />
      <span>
        {alert.kind === "storage" ? (
          <>
            {storageMessage(account.storage, alert.state)}{" "}
            <Retention owner={owner} repo={repo} />{" "}
            {billingAvailable ? (
              <OwnerAction
                owner={owner}
                account={account}
                verb={
                  account.subscription === null
                    ? "upgrade the plan"
                    : "move to a bigger plan"
                }
                purpose=" for more storage"
                event="Upgrade hint"
              />
            ) : (
              <>
                Write to{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={LINK_CLASS}
                  data-umami-event="Email"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                for a bigger plan.
              </>
            )}
          </>
        ) : alert.kind === "payment_failed" ? (
          <>
            The last payment for the {PLAN_NAMES[account.storage.plan]} plan
            failed.{" "}
            <OwnerAction
              owner={owner}
              account={account}
              verb="update the payment method"
              purpose=" to keep the plan"
            />
          </>
        ) : (
          <>
            {planEndsMessage(account.storage, alert)}
            {account.role === "owner" && (
              <>
                {" "}
                See{" "}
                <Link
                  to="/$owner/settings/billing"
                  params={{ owner }}
                  className={LINK_CLASS}
                >
                  billing
                </Link>
                .
              </>
            )}
          </>
        )}
      </span>
    </p>
  );
}

function tone(alert: AccountAlert): keyof typeof TONES {
  if (alert.kind === "plan_ends") {
    return alert.overFreeLimit ? "warning" : "info";
  }
  return alert.kind === "storage" && alert.state === "warning"
    ? "warning"
    : "error";
}

function storageMessage(
  storage: StorageUsage,
  state: "warning" | "grace" | "blocked",
): string {
  const limit = formatGigabytes(storage.storageLimitBytes);
  if (state === "warning") {
    return `${formatGigabytes(storage.storageBytes)} of ${limit} storage used.`;
  }
  if (state === "grace") {
    return `Storage limit of ${limit} reached. From ${formatDate(
      graceEndsAt(storage.overLimitSince ?? Date.now()),
    )}, new images are not stored and changes are not compared.`;
  }
  return `Storage limit of ${limit} reached. New images are not stored and changes are not compared.`;
}

function planEndsMessage(
  storage: BannerAccount["storage"],
  alert: Extract<AccountAlert, { kind: "plan_ends" }>,
): string {
  const ends = `The ${PLAN_NAMES[storage.plan]} plan ends on ${formatDate(
    alert.endsAt,
  )}, then the account moves to the Free plan with ${formatGigabytes(
    PLAN_STORAGE_LIMIT_BYTES.free,
  )} of storage.`;
  return alert.overFreeLimit
    ? `${ends} It stores ${formatGigabytes(
        storage.storageBytes,
      )}, so from ${formatDate(
        graceEndsAt(alert.endsAt),
      )} new images are not stored.`
    : ends;
}

function Retention({
  owner,
  repo,
}: {
  owner: string;
  repo?: { name: string; canAdmin: boolean };
}) {
  if (repo?.canAdmin) {
    return (
      <>
        Lower retention in{" "}
        <Link
          to="/$owner/$repo/settings"
          params={{ owner, repo: repo.name }}
          className={LINK_CLASS}
        >
          settings
        </Link>{" "}
        to free space.
      </>
    );
  }
  return (
    <>
      Repository admins can lower retention in project settings to free space.
    </>
  );
}

function OwnerAction({
  owner,
  account,
  verb,
  purpose,
  event,
}: {
  owner: string;
  account: BannerAccount;
  verb: string;
  purpose: string;
  event?: string;
}): ReactNode {
  if (account.role === "owner") {
    return (
      <>
        <Link
          to="/$owner/settings/billing"
          params={{ owner }}
          className={LINK_CLASS}
          data-umami-event={event}
          data-umami-event-source={event && "storage banner"}
        >
          {verb.charAt(0).toUpperCase()}
          {verb.slice(1)}
        </Link>
        {purpose}.
      </>
    );
  }
  if (account.role === null) {
    return `Owners of ${owner} can ${verb}${purpose}.`;
  }
  if (account.type === "user") {
    return `Ask ${owner} to ${verb}${purpose}.`;
  }
  return (
    <>
      Ask{" "}
      <Link
        to="/$owner/settings/members"
        params={{ owner }}
        className={LINK_CLASS}
      >
        an owner
      </Link>{" "}
      of {owner} to {verb}
      {purpose}.
    </>
  );
}
