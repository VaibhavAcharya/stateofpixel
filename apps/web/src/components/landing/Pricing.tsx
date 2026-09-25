import { CheckIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";
import { AuthButton } from "../SignIn";
import { LeadCopy } from "../ui";

const SECTION = "mx-auto max-w-[1448px] px-6 py-24 max-sm:px-4 max-sm:py-12";

const FREE_GIGABYTES = 10;
const RETENTION_DAYS = 60;
const PRICE_PER_GIGABYTE = 1;

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
    fits: stored <= FREE_GIGABYTES,
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

function Meter({ numbers }: { numbers: Numbers }) {
  const share = Math.min(numbers.stored / FREE_GIGABYTES, 1);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums">
          {gigabytes(numbers.stored)} stored
        </span>
        <span className="text-muted tabular-nums">
          {FREE_GIGABYTES} GB free
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset">
        <div
          className={`h-full rounded-full ${numbers.fits ? "bg-accent" : "bg-pending"}`}
          style={{ width: `${Math.max(share * 100, 1)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {numbers.fits
          ? `With ${RETENTION_DAYS}-day retention for pull request images. Fits in the free tier.`
          : `With ${RETENTION_DAYS}-day retention for pull request images. ${gigabytes(numbers.stored - FREE_GIGABYTES)} over the free tier, about ${money.format(Math.ceil((numbers.stored - FREE_GIGABYTES) * PRICE_PER_GIGABYTE))} a month. Paid plans are coming soon.`}
      </p>
    </div>
  );
}

function Struck({ numbers }: { numbers: Numbers }) {
  return (
    <dl className="flex flex-col border-t border-dotted border-field-border/50 text-subtle">
      {[
        ["Chromatic", numbers.chromatic],
        ["Argos", numbers.argos],
      ].map(([name, cost]) => (
        <div
          key={name}
          className="flex items-baseline justify-between border-b border-dotted border-field-border/50 py-3 text-sm"
        >
          <dt>{name}</dt>
          <dd className="tabular-nums line-through decoration-field-border/60">
            {money.format(Number(cost))} /mo
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Footnote({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-8 max-w-[90ch] text-xs text-muted">
      Chromatic and Argos monthly list prices from their pricing pages on 25
      September 2026, before tax. Their TurboSnap and Storybook rates can lower
      the count. Stored size counts each changed screenshot and its diff once;
      re-runs of the same pull request upload nothing new. {children}
    </p>
  );
}

const FREE_FEATURES = [
  `${FREE_GIGABYTES} GB of stored screenshots`,
  "Unlimited snapshots, builds and projects",
  "Everyone with write access can review",
  `Pull request images kept ${RETENTION_DAYS} days`,
];

const PAID_FEATURES = [
  "Everything in Free",
  `$${PRICE_PER_GIGABYTE} per GB a month above ${FREE_GIGABYTES} GB`,
  "Billed on the monthly average",
  "Longer retention",
];

function PlanCards({ fits }: { fits: boolean | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
      <div
        className={`rounded-lg p-6 ${fits === false ? "bg-surface ring-1 ring-border" : "bg-accent text-accent-fg"}`}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-base font-semibold">Free</p>
          <p className="text-[40px] leading-none font-semibold tracking-[-0.04em]">
            $0
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-2 text-sm">
          {FREE_FEATURES.map((item) => (
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
        <div className="mt-6">
          <AuthButton
            label="Install the GitHub App"
            className={fits === false ? "" : "bg-accent-fg! text-accent!"}
          />
        </div>
      </div>
      <div
        className={`rounded-lg p-6 ${fits === false ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"}`}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-base font-semibold">
            Paid
            <span className="ml-2 text-xs font-medium opacity-70">
              Coming soon
            </span>
          </p>
          <p className="text-[40px] leading-none font-semibold tracking-[-0.04em]">
            ${PRICE_PER_GIGABYTE}
            <span className="text-sm font-normal tracking-normal opacity-70">
              {" "}
              /GB
            </span>
          </p>
        </div>
        <ul className="mt-6 flex flex-col gap-2 text-sm">
          {PAID_FEATURES.map((item) => (
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
      </div>
    </div>
  );
}

export function PricingPlans() {
  const { numbers, sliders } = usePricing();
  return (
    <section id="pricing" className={`${SECTION} scroll-mt-16`}>
      <LeadCopy
        title="Pay for storage, nothing else."
        className="max-w-[760px]"
      >
        Every plan has unlimited snapshots, seats and builds. The only thing
        that grows is the storage you keep.
      </LeadCopy>
      <div className="mt-12">
        <PlanCards fits={numbers.fits} />
      </div>
      <div className="mt-12 grid grid-cols-[1fr_1.1fr] gap-12 border-t border-dotted border-field-border/50 pt-12 max-lg:grid-cols-1">
        {sliders}
        <div className="flex flex-col gap-8">
          <Meter numbers={numbers} />
          <div>
            <p className="text-xs text-subtle">
              {count.format(numbers.snapshots)} snapshots a month on
              per-snapshot pricing
            </p>
            <div className="mt-2">
              <Struck numbers={numbers} />
            </div>
          </div>
        </div>
      </div>
      <Footnote />
    </section>
  );
}
