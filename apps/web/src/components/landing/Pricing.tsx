import { CheckIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { ARGOS, CHROMATIC, cheapestPlan } from "../../lib/competitorPricing";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import type { PaidPlan } from "../../lib/useBilling";
import { AuthButton } from "../SignIn";
import { LeadCopy } from "../ui";

const SECTION = "mx-auto max-w-[1448px] px-6 py-24 max-sm:px-4 max-sm:py-12";

const RETENTION_DAYS = 60;
const YEARLY_DISCOUNT = 0.1;

const FREE_GIGABYTES = 10;
const LARGEST_GIGABYTES = 500;

export type Tier = {
  plan: "free" | PaidPlan;
  gigabytes: number;
  monthly: number;
};

export const TIERS: Tier[] = [
  { plan: "free", gigabytes: FREE_GIGABYTES, monthly: 0 },
  { plan: "25gb", gigabytes: 25, monthly: 15 },
  { plan: "100gb", gigabytes: 100, monthly: 100 },
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
  "Unlimited snapshots, builds and projects",
  "Everyone with write access can review",
  `Pull request images kept ${RETENTION_DAYS} days`,
];

const PAID_FEATURES = ["Everything in Free", "Longer retention"];

function BillingSwitch({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (billing: Billing) => void;
}) {
  return (
    <fieldset
      aria-label="Billing period"
      className="flex gap-1 self-start rounded-control bg-surface-2 p-0.5"
    >
      {(
        [
          ["monthly", "Monthly"],
          ["yearly", `Yearly, save ${YEARLY_DISCOUNT * 100}%`],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={billing === value}
          data-umami-event="Billing period"
          data-umami-event-period={value}
          onClick={() => onChange(value)}
          className={`h-7 rounded-sm px-3 text-xs font-medium transition-colors duration-100 ${
            billing === value
              ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
              : "text-muted hover:text-text"
          }`}
        >
          {label}
        </button>
      ))}
    </fieldset>
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
      className={`flex flex-col rounded-lg bg-surface p-6 ${free ? "pixel-texture col-span-2 max-lg:col-span-3 max-sm:col-span-1" : ""} ring-1 ring-border`}
    >
      <p className="text-base font-semibold">
        {free ? "Free" : `${tier.gigabytes} GB`}
        {!free && !available && (
          <span className="ml-2 text-xs font-medium opacity-70">
            Coming soon
          </span>
        )}
      </p>
      <p className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
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
          <AuthButton label="Install the GitHub App" />
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
        Every plan has unlimited snapshots, seats and builds. {FREE_GIGABYTES}{" "}
        GB is free, which covers most teams.
      </LeadCopy>
      <div className="mt-12 flex flex-col gap-4">
        <BillingSwitch billing={billing} onChange={setBilling} />
        <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-1">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.gigabytes}
              tier={tier}
              billing={billing}
              available={available === true}
            />
          ))}
        </div>
        <p className="text-sm text-muted">
          Need more than {LARGEST_GIGABYTES} GB?{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-link"
            data-umami-event="Email"
          >
            Write to {SUPPORT_EMAIL}
          </a>
          .{available !== true && " Paid plans are coming soon."}
        </p>
      </div>
    </section>
  );
}
