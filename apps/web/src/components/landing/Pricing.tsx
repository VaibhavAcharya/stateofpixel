import { CheckIcon } from "@phosphor-icons/react/ssr";
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "@stateofpixel/backend/limits";
import { PLAN_STORAGE_LIMIT_BYTES } from "@stateofpixel/backend/storage";
import { useState } from "react";
import {
  Badge,
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameFooter,
  CardFrameHeader,
  CardFrameTitle,
  cn,
  RadioGroupPrimitive,
  RadioPrimitive,
  SegmentedControl,
  SegmentedControlItem,
} from "uiofcraft";
import { api, useQuery } from "../../lib/backend";
import { ARGOS, CHROMATIC, cheapestPlan } from "../../lib/competitorPricing";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import type { PaidPlan } from "../../lib/useBilling";
import { AuthButton } from "../SignIn";
import { LeadCopy } from "../ui";

const SECTION = "mx-auto w-full max-w-[1416px] px-4 py-16 sm:px-6 sm:py-24";

const RETENTION_DAYS = DEFAULT_RETENTION_DAYS;
const YEARLY_DISCOUNT = 0.1;

const gigabytesOf = (plan: keyof typeof PLAN_STORAGE_LIMIT_BYTES) =>
  PLAN_STORAGE_LIMIT_BYTES[plan] / 1024 ** 3;

const FREE_GIGABYTES = gigabytesOf("free");
const LARGEST_GIGABYTES = gigabytesOf("500gb");

export type Tier = {
  plan: "free" | PaidPlan;
  gigabytes: number;
  monthly: number;
};

export const TIERS: Tier[] = [
  { plan: "free", gigabytes: FREE_GIGABYTES, monthly: 0 },
  { plan: "25gb", gigabytes: gigabytesOf("25gb"), monthly: 15 },
  { plan: "100gb", gigabytes: gigabytesOf("100gb"), monthly: 100 },
  { plan: "500gb", gigabytes: LARGEST_GIGABYTES, monthly: 500 },
];

export type Billing = "monthly" | "yearly";

export function monthlyPrice(tier: Tier, billing: Billing) {
  return billing === "yearly"
    ? tier.monthly * (1 - YEARLY_DISCOUNT)
    : tier.monthly;
}

function fittingTier(gigabytes: number) {
  return TIERS.find((tier) => gigabytes <= tier.gigabytes) ?? null;
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const exactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function gigabytes(value: number) {
  return value < 1
    ? `${Math.round(value * 1024)} MB`
    : `${value.toFixed(1)} GB`;
}

export type Workload = {
  screens: number;
  variants: number;
  builds: number;
  changed: number;
  kilobytes: number;
};

export const DEFAULT_WORKLOAD: Workload = {
  screens: 300,
  variants: 3,
  builds: 400,
  changed: 5,
  kilobytes: 80,
};

export function estimate(workload: Workload) {
  const snapshots = workload.screens * workload.variants * workload.builds;
  const monthlyImages = snapshots * (workload.changed / 100) * 2;
  const stored =
    (monthlyImages * workload.kilobytes * (RETENTION_DAYS / 30)) / 1024 / 1024;
  return {
    snapshots,
    stored,
    tier: fittingTier(stored),
    chromatic: cheapestPlan(CHROMATIC, snapshots).cost,
    argos: cheapestPlan(ARGOS, snapshots).cost,
  };
}

export function formatPrice(value: number) {
  return Number.isInteger(value)
    ? money.format(value)
    : exactMoney.format(value);
}

const INCLUDED = [
  "No charge for snapshots, builds or projects",
  "Everyone with write access can review",
  `Pull request images kept ${RETENTION_DAYS} days, adjustable from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}`,
];

function BillingSwitch({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (billing: Billing) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Billing period"
      className="self-start"
      render={
        <RadioGroupPrimitive
          value={billing}
          onValueChange={(value) => onChange(value as Billing)}
        />
      }
    >
      {(
        [
          ["monthly", "Monthly"],
          ["yearly", `Yearly, save ${YEARLY_DISCOUNT * 100}%`],
        ] as const
      ).map(([value, label]) => (
        <SegmentedControlItem
          key={value}
          render={
            <RadioPrimitive.Root
              value={value}
              data-umami-event="Billing period"
              data-umami-event-period={value}
            />
          }
        >
          {label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function TierColumn({
  tier,
  billing,
  available,
}: {
  tier: Tier;
  billing: Billing;
  available: boolean;
}) {
  const free = tier.monthly === 0;
  const price = monthlyPrice(tier, billing);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col p-6",
        free && "pixel-texture bg-muted/40",
      )}
    >
      <p className="flex items-center gap-2 font-medium text-sm">
        {free ? "Free" : `${tier.gigabytes} GB`}
        {!free && !available && (
          <Badge variant="outline" className="text-muted-foreground">
            Coming soon
          </Badge>
        )}
      </p>
      <p className="mt-6 font-heading font-semibold text-5xl tracking-[-0.02em] tabular-nums">
        {formatPrice(price)}
        <span className="font-normal font-sans text-base text-muted-foreground tracking-normal">
          {" "}
          /mo
        </span>
      </p>
      <p className="mt-2 text-muted-foreground text-xs">
        {free
          ? "No card needed. Enough for most teams."
          : billing === "yearly"
            ? `${money.format(price * 12)} billed yearly`
            : "Billed monthly"}
      </p>
      <p className="mt-6 flex items-center gap-2 text-sm">
        <CheckIcon size={14} weight="bold" className="shrink-0 text-approved" />
        {tier.gigabytes} GB of stored screenshots
      </p>
      <div className="mt-auto pt-8">
        {free ? (
          <AuthButton label="Start free with GitHub" />
        ) : (
          <p className="text-muted-foreground text-xs">
            Upgrade from the account's Billing page.
          </p>
        )}
      </div>
    </div>
  );
}

export function PricingPlans() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const available = useQuery(api.billing.available);
  return (
    <section id="pricing" className={`${SECTION} scroll-mt-16`}>
      <LeadCopy
        title="Pay for storage, nothing else."
        className="max-w-[760px]"
      >
        No plan charges for snapshots, seats or builds. {FREE_GIGABYTES} GB is
        free, which covers most teams. The Usage page shows what each project
        stores.
      </LeadCopy>
      <CardFrame className="mt-12">
        <CardFrameHeader className="py-3">
          <CardFrameTitle>Plans</CardFrameTitle>
          <CardFrameAction>
            <BillingSwitch billing={billing} onChange={setBilling} />
          </CardFrameAction>
        </CardFrameHeader>
        <Card className="overflow-hidden">
          <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x max-lg:sm:[&>*:nth-child(-n+2)]:border-b max-lg:sm:[&>*:nth-child(odd)]:border-r">
            {TIERS.map((tier) => (
              <TierColumn
                key={tier.gigabytes}
                tier={tier}
                billing={billing}
                available={available !== false}
              />
            ))}
          </div>
        </Card>
        <CardFrameFooter className="flex flex-wrap gap-x-8 gap-y-2 py-4">
          <span className="font-medium text-sm">Every plan</span>
          {INCLUDED.map((item) => (
            <span
              key={item}
              className="flex items-center gap-2 text-muted-foreground text-sm"
            >
              <CheckIcon size={14} weight="bold" className="shrink-0" />
              {item}
            </span>
          ))}
        </CardFrameFooter>
      </CardFrame>
      <p className="mt-4 text-muted-foreground text-sm">
        Need more than {LARGEST_GIGABYTES} GB?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-link"
          data-umami-event="Email"
        >
          Write to {SUPPORT_EMAIL}
        </a>
        .{available === false && " Paid plans are coming soon."}
      </p>
    </section>
  );
}
