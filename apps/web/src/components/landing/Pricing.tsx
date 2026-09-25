import { CheckIcon } from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import { type PaidPlan, useBilling } from "../../lib/useBilling";
import { Menu, MenuLabel, menuItemClass, useCloseMenu } from "../Menu";
import { AuthButton } from "../SignIn";
import { Avatar, accountAvatar, buttonClass, LeadCopy } from "../ui";

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

type Plan = { price: number; included: number; extra: number | null };

const CHROMATIC: Plan[] = [
  { price: 0, included: 5_000, extra: null },
  { price: 179, included: 35_000, extra: 0.008 },
  { price: 399, included: 85_000, extra: 0.008 },
];

const ARGOS: Plan[] = [
  { price: 0, included: 5_000, extra: null },
  { price: 100, included: 35_000, extra: 0.004 },
];

function cheapest(plans: Plan[], snapshots: number) {
  return Math.min(
    ...plans
      .filter((plan) => plan.extra !== null || snapshots <= plan.included)
      .map(
        (plan) =>
          plan.price +
          Math.max(0, snapshots - plan.included) * (plan.extra ?? 0),
      ),
  );
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
const count = new Intl.NumberFormat("en-US");

function gigabytes(value: number) {
  return value < 1
    ? `${Math.round(value * 1024)} MB`
    : `${value.toFixed(1)} GB`;
}

function usePricing() {
  const [screens, setScreens] = useState(300);
  const [variants, setVariants] = useState(3);
  const [builds, setBuilds] = useState(400);
  const [changed, setChanged] = useState(5);
  const [kilobytes, setKilobytes] = useState(80);
  const snapshots = screens * variants * builds;
  const monthlyImages = snapshots * (changed / 100) * 2;
  const stored =
    (monthlyImages * kilobytes * (RETENTION_DAYS / 30)) / 1024 / 1024;
  const numbers = {
    snapshots,
    stored,
    tier: fittingTier(stored),
    chromatic: cheapest(CHROMATIC, snapshots),
    argos: cheapest(ARGOS, snapshots),
  };
  const sliders = (
    <div className="flex flex-col gap-6">
      <Range
        label="Stories or pages"
        value={screens}
        min={20}
        max={2000}
        step={10}
        onChange={setScreens}
      />
      <Range
        label="Viewports and themes"
        value={variants}
        min={1}
        max={8}
        step={1}
        onChange={setVariants}
      />
      <Range
        label="Builds per month"
        value={builds}
        min={20}
        max={2000}
        step={10}
        onChange={setBuilds}
      />
      <Range
        label="Changed per build"
        value={changed}
        min={1}
        max={30}
        step={1}
        suffix="%"
        onChange={setChanged}
      />
      <Range
        label="Average screenshot"
        value={kilobytes}
        min={10}
        max={300}
        step={10}
        suffix=" KB"
        onChange={setKilobytes}
      />
    </div>
  );
  return { numbers, sliders };
}

type Numbers = ReturnType<typeof usePricing>["numbers"];

function Range({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">
          {count.format(value)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-[var(--color-accent)]"
      />
    </label>
  );
}

export function formatPrice(value: number) {
  return Number.isInteger(value)
    ? money.format(value)
    : exactMoney.format(value);
}

function Meter({ numbers, billing }: { numbers: Numbers; billing: Billing }) {
  const { tier } = numbers;
  const limit = tier?.gigabytes ?? LARGEST_GIGABYTES;
  const share = Math.min(numbers.stored / limit, 1);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums">
          {gigabytes(numbers.stored)} stored
        </span>
        <span className="text-muted tabular-nums">
          {tier === null
            ? `Over ${LARGEST_GIGABYTES} GB`
            : `${tier.gigabytes} GB ${tier.monthly === 0 ? "free" : "plan"}`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
        <div
          className={`h-full rounded-full ${tier?.monthly === 0 ? "bg-accent" : "bg-pending"}`}
          style={{ width: `${Math.max(share * 100, 1)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        With {RETENTION_DAYS}-day retention for pull request images.{" "}
        {tier === null ? (
          <>
            More than our largest plan,{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-link"
              data-umami-event="Email"
            >
              write to us
            </a>
            .
          </>
        ) : tier.monthly === 0 ? (
          "Fits in the free tier."
        ) : (
          `Fits in the ${tier.gigabytes} GB plan, ${formatPrice(monthlyPrice(tier, billing))} a month.`
        )}
      </p>
    </div>
  );
}

function Comparison({
  numbers,
  billing,
}: {
  numbers: Numbers;
  billing: Billing;
}) {
  const ours =
    numbers.tier === null ? null : monthlyPrice(numbers.tier, billing);
  return (
    <div>
      <p className="text-xs text-subtle">
        {count.format(numbers.snapshots)} snapshots a month on per-snapshot
        pricing
      </p>
      <dl className="mt-2 flex flex-col border-t border-dotted border-field-border/50">
        <div className="flex items-baseline justify-between border-b border-dotted border-field-border/50 py-3 text-sm font-medium">
          <dt>stateofpixel</dt>
          <dd className="tabular-nums">
            {ours === null ? "Contact us" : `${formatPrice(ours)} /mo`}
          </dd>
        </div>
        {[
          ["Chromatic", numbers.chromatic],
          ["Argos", numbers.argos],
        ].map(([name, cost]) => (
          <div
            key={name}
            className="flex items-baseline justify-between border-b border-dotted border-field-border/50 py-3 text-sm text-subtle"
          >
            <dt>{name}</dt>
            <dd className="tabular-nums line-through decoration-field-border/60">
              {money.format(Number(cost))} /mo
            </dd>
          </div>
        ))}
      </dl>
      {ours !== null && (
        <p className="mt-3 text-sm font-medium">
          {money.format(numbers.argos - ours)} a month less than Argos,{" "}
          {money.format(numbers.chromatic - ours)} less than Chromatic.
        </p>
      )}
    </div>
  );
}

function Footnote({ available }: { available: boolean }) {
  return (
    <p className="mt-8 max-w-[90ch] text-xs text-muted">
      Chromatic and Argos monthly list prices from their pricing pages on 25
      September 2026, before tax. Their TurboSnap and Storybook rates can lower
      the count. Stored size counts each changed screenshot and its diff once;
      re-runs of the same pull request upload nothing new.
      {!available && " Paid plans are coming soon."}
    </p>
  );
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
  highlighted,
  available,
}: {
  tier: Tier;
  billing: Billing;
  highlighted: boolean;
  available: boolean;
}) {
  const free = tier.monthly === 0;
  const price = monthlyPrice(tier, billing);
  return (
    <div
      className={`flex flex-col rounded-lg bg-surface p-6 ${free ? "pixel-texture col-span-2 max-lg:col-span-3 max-sm:col-span-1" : ""} ${highlighted ? "ring-2 ring-accent" : "ring-1 ring-border"}`}
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
      {free ? (
        <div className="mt-auto pt-6">
          <AuthButton label="Install the GitHub App" />
        </div>
      ) : (
        available &&
        tier.plan !== "free" && (
          <ChooseAccount
            plan={tier.plan}
            gigabytes={tier.gigabytes}
            billing={billing}
          />
        )
      )}
    </div>
  );
}

function ChooseAccount({
  plan,
  gigabytes,
  billing,
}: {
  plan: PaidPlan;
  gigabytes: number;
  billing: Billing;
}) {
  const { isAuthenticated } = useConvexAuth();
  const accounts = useQuery(api.me.accounts, isAuthenticated ? {} : "skip");
  const checkout = useBilling();
  const installed = accounts?.filter((account) => account.installed) ?? [];
  if (installed.length === 0) {
    return null;
  }
  return (
    <div className="mt-auto pt-6">
      <Menu
        label={`Choose ${gigabytes} GB`}
        triggerClassName={`${buttonClass()} w-full`}
        trigger={
          checkout.pending ? "Opening checkout" : `Choose ${gigabytes} GB`
        }
      >
        <MenuLabel>For account</MenuLabel>
        {installed.map((account) => (
          <AccountItem
            key={account.login}
            login={account.login}
            onChoose={() =>
              void checkout.checkout(account.login, plan, billing)
            }
          />
        ))}
      </Menu>
      {checkout.error !== null && (
        <p className="mt-2 text-xs text-failed">{checkout.error}</p>
      )}
    </div>
  );
}

function AccountItem({
  login,
  onChoose,
}: {
  login: string;
  onChoose: () => void;
}) {
  const close = useCloseMenu();
  return (
    <button
      type="button"
      className={menuItemClass}
      data-umami-event="Checkout"
      onClick={() => {
        close();
        onChoose();
      }}
    >
      <Avatar src={accountAvatar(login)} size={16} square />
      {login}
    </button>
  );
}

export function PricingPlans() {
  const { numbers, sliders } = usePricing();
  const [billing, setBilling] = useState<Billing>("monthly");
  const available = useQuery(api.billing.available);
  return (
    <section id="pricing" className={`${SECTION} scroll-mt-16`}>
      <LeadCopy
        title="Pay for storage, nothing else."
        className="max-w-[760px]"
      >
        Every plan has unlimited snapshots, seats and builds. {FREE_GIGABYTES}{" "}
        GB is free, which covers most teams. Move the sliders to check yours.
      </LeadCopy>
      <div className="mt-12 flex flex-col gap-4">
        <BillingSwitch billing={billing} onChange={setBilling} />
        <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-1">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.gigabytes}
              tier={tier}
              billing={billing}
              highlighted={tier === (numbers.tier ?? null)}
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
          .
        </p>
      </div>
      <div className="mt-12 grid grid-cols-[1fr_1.1fr] gap-12 border-t border-dotted border-field-border/50 pt-12 max-lg:grid-cols-1">
        {sliders}
        <div className="flex flex-col gap-8">
          <Meter numbers={numbers} billing={billing} />
          <Comparison numbers={numbers} billing={billing} />
        </div>
      </div>
      <Footnote available={available === true} />
    </section>
  );
}
