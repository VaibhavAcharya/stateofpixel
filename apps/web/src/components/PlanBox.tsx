import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import {
  formatGigabytes,
  type StorageUsage,
} from "@stateofpixel/backend/storage";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { ReactNode } from "react";
import { type PaidPlan, useBilling } from "../lib/useBilling";
import {
  type Billing,
  formatPrice,
  monthlyPrice,
  TIERS,
} from "./landing/Pricing";
import {
  Menu,
  MenuLabel,
  MenuSeparator,
  menuItemClass,
  useCloseMenu,
} from "./Menu";
import { buttonClass } from "./ui";

const PLAN_NAMES = {
  free: "Free",
  "25gb": "25 GB",
  "100gb": "100 GB",
  "500gb": "500 GB",
  custom: "Custom",
} as const;

export function PlanBox({
  login,
  storage,
  subscribed,
  billingCustomer,
}: {
  login: string;
  storage: StorageUsage & { plan: keyof typeof PLAN_NAMES };
  subscribed: boolean;
  billingCustomer: boolean;
}) {
  const available = useQuery(api.billing.available);
  const billing = useBilling();
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 ring-1 ring-border">
      <div className="text-sm">
        <span className="font-medium">{PLAN_NAMES[storage.plan]} plan</span>
        <span className="text-muted tabular-nums">
          {" "}
          · {formatGigabytes(storage.storageBytes)} of{" "}
          {formatGigabytes(storage.storageLimitBytes)} used
        </span>
        {billing.error !== null && (
          <p className="mt-1 text-failed">{billing.error}</p>
        )}
      </div>
      {available && (
        <div className="flex gap-2">
          {billingCustomer && (
            <button
              type="button"
              className={buttonClass()}
              disabled={billing.pending}
              onClick={() => void billing.manage(login)}
            >
              Manage billing
            </button>
          )}
          {!subscribed && (
            <UpgradeMenu
              pending={billing.pending}
              onChoose={(plan, interval) =>
                void billing.checkout(login, plan, interval)
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

export function UpgradeMenu({
  label = "Upgrade",
  pending,
  onChoose,
}: {
  label?: string;
  pending: boolean;
  onChoose: (plan: PaidPlan, interval: Billing) => void;
}) {
  return (
    <Menu
      label={label}
      align="end"
      triggerClassName={buttonClass("primary")}
      trigger={
        <>
          {pending ? "Opening checkout" : label}
          <CaretDownIcon size={12} />
        </>
      }
    >
      {(["monthly", "yearly"] as const).map((interval, index) => (
        <div key={interval}>
          {index > 0 && <MenuSeparator />}
          <MenuLabel>{interval === "monthly" ? "Monthly" : "Yearly"}</MenuLabel>
          {TIERS.map((tier) =>
            tier.plan === "free" ? null : (
              <UpgradeItem
                key={tier.plan}
                plan={tier.plan}
                interval={interval}
                onChoose={onChoose}
              >
                {tier.gigabytes} GB
                <span className="text-muted tabular-nums">
                  {formatPrice(monthlyPrice(tier, interval))} /mo
                </span>
              </UpgradeItem>
            ),
          )}
        </div>
      ))}
    </Menu>
  );
}

function UpgradeItem({
  plan,
  interval,
  onChoose,
  children,
}: {
  plan: PaidPlan;
  interval: Billing;
  onChoose: (plan: PaidPlan, interval: Billing) => void;
  children: ReactNode;
}) {
  const close = useCloseMenu();
  return (
    <button
      type="button"
      className={`${menuItemClass} justify-between`}
      data-umami-event="Checkout"
      data-umami-event-plan={plan}
      data-umami-event-period={interval}
      onClick={() => {
        close();
        onChoose(plan, interval);
      }}
    >
      {children}
    </button>
  );
}
