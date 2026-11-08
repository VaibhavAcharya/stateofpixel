import {
  CaretDownIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import {
  formatGigabytes,
  type StorageUsage,
} from "@stateofpixel/backend/storage";
import type { ReactNode } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
} from "uiofcraft";
import type { Subscription } from "../lib/accountAlert";
import { api, useQuery } from "../lib/backend";
import { formatDate } from "../lib/format";
import {
  type BillingInterval,
  type PaidPlan,
  type PlanChange,
  useBilling,
} from "../lib/useBilling";
import {
  type Billing,
  formatPrice,
  monthlyPrice,
  TIERS,
} from "./landing/Pricing";
import { Menu, MenuSeparator } from "./Menu";
import { Tooltip } from "./ui";

const LOCKED_BUTTON_CLASS = "cursor-not-allowed opacity-64";

export const PLAN_NAMES = {
  free: "Free",
  "25gb": "25 GB",
  "100gb": "100 GB",
  "500gb": "500 GB",
  unlimited: "Unlimited",
  custom: "Custom",
} as const;

export type CheckoutResult = { subscriptionId: string; status: string };

type Notice = { tone: "success" | "info" | "error"; text: string };

const NOTICE_ICONS = {
  success: CheckCircleIcon,
  info: InfoIcon,
  error: WarningIcon,
} as const;

const PAID_STATUSES = new Set(["active", "succeeded"]);
const PROCESSING_STATUSES = new Set(["pending", "processing"]);

function planNotice(
  planName: string,
  subscription: Subscription | null,
  checkoutResult: CheckoutResult | null,
  change: PlanChange | null,
  changed: boolean,
): Notice | null {
  if (change?.submitted) {
    return changed
      ? {
          tone: "success",
          text: `Plan changed. You are on the ${planName} plan.`,
        }
      : {
          tone: "info",
          text: "Plan change received. Your plan updates in a few seconds.",
        };
  }
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
  return null;
}

function periodLine(subscription: Subscription | null): string | null {
  if (subscription?.status !== "active" || subscription.periodEndsAt === null) {
    return null;
  }
  const date = formatDate(subscription.periodEndsAt);
  return subscription.cancelsAtPeriodEnd
    ? `Ends on ${date}`
    : `Renews on ${date}`;
}

export function PlanBox({
  login,
  accountType,
  storage,
  subscription,
  billingCustomer,
  role,
  checkoutResult,
  onDismissCheckout,
}: {
  login: string;
  accountType: "user" | "org";
  storage: StorageUsage & { plan: keyof typeof PLAN_NAMES };
  subscription: Subscription | null;
  billingCustomer: boolean;
  role: "owner" | "member" | null;
  checkoutResult: CheckoutResult | null;
  onDismissCheckout: () => void;
}) {
  const available = useQuery(api.billing.available);
  const billing = useBilling();
  const planName = PLAN_NAMES[storage.plan];
  const change = billing.change;
  const changed =
    change !== null &&
    storage.plan === change.plan &&
    subscription?.interval === change.interval;
  const notice = planNotice(
    planName,
    subscription,
    checkoutResult,
    change,
    changed,
  );
  const canChange =
    subscription?.status === "active" && !subscription.cancelsAtPeriodEnd;
  const period = periodLine(subscription);
  const lockedReason =
    role !== "member"
      ? undefined
      : accountType === "org"
        ? `Only owners of ${login} on GitHub can change the plan and billing.`
        : `Only ${login} can change the plan and billing.`;
  return (
    <div className="flex flex-col gap-2">
      {notice !== null && (
        <PlanNotice
          notice={notice}
          onDismiss={
            change?.submitted
              ? billing.cancelChange
              : checkoutResult === null
                ? undefined
                : onDismissCheckout
          }
        />
      )}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs/5">
        <div className="text-sm">
          <span className="font-medium">{planName} plan</span>
          <span className="text-muted-foreground tabular-nums">
            {" "}
            · {formatGigabytes(storage.storageBytes)}
            {storage.plan === "unlimited"
              ? " used"
              : ` of ${formatGigabytes(storage.storageLimitBytes)} used`}
          </span>
          {period !== null && (
            <span className="text-muted-foreground"> · {period}</span>
          )}
          {billing.error !== null && (
            <p className="mt-1 text-failed">{billing.error}</p>
          )}
        </div>
        {available && (
          <div className="flex gap-2">
            {billingCustomer &&
              (lockedReason === undefined ? (
                <Button
                  variant="outline"
                  disabled={billing.pending}
                  onClick={() => void billing.manage(login)}
                >
                  Manage billing
                </Button>
              ) : (
                <Tooltip label={lockedReason} align="end">
                  <Button
                    variant="outline"
                    aria-disabled
                    className={LOCKED_BUTTON_CLASS}
                  >
                    Manage billing
                  </Button>
                </Tooltip>
              ))}
            {subscription === null && (
              <UpgradeMenu
                disabledReason={lockedReason}
                pending={billing.pending}
                onChoose={(plan, interval) =>
                  void billing.checkout(login, plan, interval)
                }
              />
            )}
            {canChange && (
              <UpgradeMenu
                label="Change plan"
                disabledReason={lockedReason}
                pending={false}
                current={
                  subscription.interval === null
                    ? undefined
                    : { plan: storage.plan, interval: subscription.interval }
                }
                onChoose={(plan, interval) =>
                  void billing.startChange(login, plan, interval)
                }
              />
            )}
          </div>
        )}
      </section>
      {available && billingCustomer && (
        <p className="px-1 text-xs text-muted-foreground">
          Manage billing opens the Dodo Payments portal, where you update the
          card, download invoices and cancel.
        </p>
      )}
      {change !== null && !change.submitted && (
        <ChangeConfirm
          change={change}
          pending={billing.pending}
          onCancel={billing.cancelChange}
          onConfirm={() => void billing.confirmChange(login)}
        />
      )}
    </div>
  );
}

function formatAmount(amount: number, currency: string): string {
  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}

function ChangeConfirm({
  change,
  pending,
  onCancel,
  onConfirm,
}: {
  change: PlanChange;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const target = `${PLAN_NAMES[change.plan]} plan, billed ${change.interval}`;
  const { preview } = change;
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs/5">
      {preview === null ? (
        <p className="text-muted-foreground">
          Checking the price of the {target}.
        </p>
      ) : (
        <p className="max-w-prose">
          <span className="font-medium">Move to the {target}?</span>{" "}
          <span className="text-muted-foreground">
            {preview.amount === 0
              ? "You pay nothing now."
              : `You pay ${formatAmount(preview.amount, preview.currency)} now.`}{" "}
            Unused time on your current plan counts toward it, and any left over
            is credited to later renewals. The new plan renews on{" "}
            {formatDate(preview.renewsAt)}.
          </span>
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={preview === null || pending} onClick={onConfirm}>
          {pending ? "Changing plan" : "Change plan"}
        </Button>
      </div>
    </section>
  );
}

function PlanNotice({
  notice,
  onDismiss,
}: {
  notice: Notice;
  onDismiss?: () => void;
}) {
  const Icon = NOTICE_ICONS[notice.tone];
  return (
    <Alert role="status" variant={notice.tone}>
      <Icon size={16} />
      <AlertDescription className="text-foreground">
        {notice.text}
      </AlertDescription>
      {onDismiss !== undefined && (
        <AlertAction>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <XIcon size={12} />
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

export function UpgradeMenu({
  label = "Upgrade",
  disabledReason,
  pending,
  current,
  onChoose,
}: {
  label?: string;
  disabledReason?: string;
  pending: boolean;
  current?: { plan: string; interval: BillingInterval };
  onChoose: (plan: PaidPlan, interval: Billing) => void;
}) {
  if (disabledReason !== undefined) {
    return (
      <Tooltip label={disabledReason} align="end">
        <Button aria-disabled className={LOCKED_BUTTON_CLASS}>
          {label}
          <CaretDownIcon size={12} />
        </Button>
      </Tooltip>
    );
  }
  return (
    <Menu
      label={label}
      align="end"
      triggerRender={<Button />}
      trigger={
        <>
          {pending ? "Opening checkout" : label}
          <CaretDownIcon size={12} />
        </>
      }
    >
      {(["monthly", "yearly"] as const).map((interval, index) => (
        <MenuGroup key={interval}>
          {index > 0 && <MenuSeparator />}
          <MenuGroupLabel>
            {interval === "monthly" ? "Monthly" : "Yearly"}
          </MenuGroupLabel>
          {TIERS.map((tier) =>
            tier.plan === "free" ? null : (
              <UpgradeItem
                key={tier.plan}
                plan={tier.plan}
                interval={interval}
                isCurrent={
                  current?.plan === tier.plan && current.interval === interval
                }
                onChoose={onChoose}
              >
                {tier.gigabytes} GB
                <span className="text-muted-foreground tabular-nums">
                  {current?.plan === tier.plan && current.interval === interval
                    ? "Current"
                    : `${formatPrice(monthlyPrice(tier, interval))} /mo`}
                </span>
              </UpgradeItem>
            ),
          )}
        </MenuGroup>
      ))}
    </Menu>
  );
}

function UpgradeItem({
  plan,
  interval,
  isCurrent,
  onChoose,
  children,
}: {
  plan: PaidPlan;
  interval: Billing;
  isCurrent: boolean;
  onChoose: (plan: PaidPlan, interval: Billing) => void;
  children: ReactNode;
}) {
  return (
    <MenuItem
      className="justify-between"
      disabled={isCurrent}
      data-umami-event="Checkout"
      data-umami-event-plan={plan}
      data-umami-event-period={interval}
      onClick={() => onChoose(plan, interval)}
    >
      {children}
    </MenuItem>
  );
}
