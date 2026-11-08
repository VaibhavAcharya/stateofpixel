import { CheckIcon } from "@phosphor-icons/react/ssr";
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "@stateofpixel/backend/limits";
import { PLAN_STORAGE_LIMIT_BYTES } from "@stateofpixel/backend/storage";
import { useState } from "react";
import {
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

const FREE_FEATURES = [
  "No charge for snapshots, builds or projects",
  "Everyone with write access can review",
  `Pull request images kept ${RETENTION_DAYS} days, adjustable from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}`,
];

const PAID_FEATURES = ["Everything in Free"];

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

function TierCard({
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
      className={`flex flex-col rounded-2xl border bg-card p-6 shadow-xs/5 ${free ? "pixel-texture col-span-2 max-lg:col-span-3 max-sm:col-span-1" : ""}`}
    >
      <p className="text-sm font-semibold">
        {free ? "Free" : `${tier.gigabytes} GB`}
        {!free && !available && (
          <span className="ml-2 text-xs font-medium opacity-70">
            Coming soon
          </span>
        )}
      </p>
      <p className="mt-4 text-[40px] leading-none font-heading font-semibold tracking-[-0.02em] tabular-nums">
        {formatPrice(price)}
        <span className="text-sm font-normal tracking-normal opacity-70">
          {" "}
          /mo
        </span>
      </p>
      <p className="mt-2 h-4 text-xs opacity-70">
        {free
          ? "No card needed. Enough for most teams."
          : billing === "yearly"
            ? `${money.format(price * 12)} billed yearly`
            : "Billed monthly"}
      </p>
      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {[
          `${tier.gigabytes} GB of stored screenshots`,
          ...(free ? FREE_FEATURES : PAID_FEATURES),
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <CheckIcon
              size={14}
              weight="bold"
              className="shrink-0 opacity-70"
            />
            {item}
          </li>
        ))}
      </ul>
      {free && (
        <div className="mt-auto pt-6">
          <AuthButton label="Start free with GitHub" />
        </div>
      )}
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
      <div className="mt-12 flex flex-col gap-4">
        <BillingSwitch billing={billing} onChange={setBilling} />
        <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-1">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.gigabytes}
              tier={tier}
              billing={billing}
              available={available !== false}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
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
      </div>
    </section>
  );
}
