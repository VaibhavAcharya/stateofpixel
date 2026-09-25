import {
  CaretDownIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
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

export const PLAN_NAMES = {
  free: "Free",
  "25gb": "25 GB",
  "100gb": "100 GB",
  "500gb": "500 GB",
  custom: "Custom",
} as const;

export type CheckoutResult = { subscriptionId: string; status: string };

type Notice = { tone: "success" | "info" | "error"; text: string };

const NOTICE_STYLES = {
  success: {
    box: "bg-approved-bg",
    icon: "text-approved",
    Icon: CheckCircleIcon,
  },
  info: { box: "bg-pending-bg", icon: "text-pending", Icon: InfoIcon },
  error: { box: "bg-failed-bg", icon: "text-failed", Icon: WarningIcon },
} as const;

const PAID_STATUSES = new Set(["active", "succeeded"]);
const PROCESSING_STATUSES = new Set(["pending", "processing"]);
const FAILED_RENEWAL_STATUSES = new Set(["on_hold", "past_due"]);

function planNotice(
  planName: string,
  subscription: Subscription | null,
  checkoutResult: CheckoutResult | null,
): Notice | null {
  if (checkoutResult !== null) {
    if (PAID_STATUSES.has(checkoutResult.status)) {
      return subscription?.id === checkoutResult.subscriptionId &&
        subscription.status === "active"
        ? {
            tone: "success",
            text: `Payment received. You are on the ${planName} plan.`,
          }
        : {
            tone: "info",
            text: "Payment received. Your plan updates in a few seconds.",
          };
    }
    if (PROCESSING_STATUSES.has(checkoutResult.status)) {
      return {
        tone: "info",
        text: "Your payment is processing. Your plan changes once it clears.",
      };
    }
    return {
      tone: "error",
      text: "The payment did not go through, so your plan did not change. Try again, or use another card.",
    };
  }
  if (
    subscription !== null &&
    FAILED_RENEWAL_STATUSES.has(subscription.status)
  ) {
    return {
      tone: "error",
      text: `Your last payment failed. Update your payment method in Manage billing to keep the ${planName} plan.`,
    };
  }
  return null;
}

type Subscription = { id: string; status: string };

export function PlanBox({
  login,
  storage,
  subscription,
  billingCustomer,
  checkoutResult,
  onDismissCheckout,
}: {
  login: string;
  storage: StorageUsage & { plan: keyof typeof PLAN_NAMES };
  subscription: Subscription | null;
  billingCustomer: boolean;
  checkoutResult: CheckoutResult | null;
  onDismissCheckout: () => void;
}) {
  const available = useQuery(api.billing.available);
  const billing = useBilling();
  const planName = PLAN_NAMES[storage.plan];
  const notice = planNotice(planName, subscription, checkoutResult);
  return (
    <div id="plan" className="mb-6 flex scroll-mt-4 flex-col gap-2">
      {notice !== null && (
        <PlanNotice
          notice={notice}
          onDismiss={checkoutResult === null ? undefined : onDismissCheckout}
        />
      )}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 ring-1 ring-border">
        <div className="text-sm">
          <span className="font-medium">{planName} plan</span>
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
            {subscription === null && (
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
    </div>
  );
}

function PlanNotice({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss?: () => void;
}) {
  const { box, icon, Icon } = NOTICE_STYLES[notice.tone];
  return (
    <p
      role="status"
      className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm ${box}`}
    >
      <Icon size={16} className={`shrink-0 ${icon}`} />
      <span className="flex-1">{notice.text}</span>
      {onDismiss !== undefined && (
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-sm p-1 text-muted hover:text-text"
          onClick={onDismiss}
        >
          <XIcon size={12} />
        </button>
      )}
    </p>
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
