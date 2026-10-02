import { useState } from "react";
import { CHECKED, type Priced } from "../../content/compare";
import {
  ARGOS,
  CHROMATIC,
  cheapestPlan,
  PERCY,
  type Plan,
} from "../../lib/competitorPricing";
import { facts } from "../docs/facts";
import {
  DEFAULT_WORKLOAD,
  estimate,
  formatPrice,
  gigabytes,
  monthlyPrice,
} from "../landing/Pricing";
import { SECTION, WIDE } from "../landing/sections";
import { RangeSlider } from "../RangeSlider";
import { LeadCopy, Logo } from "../ui";

const count = new Intl.NumberFormat("en-US");

const PRICED: Record<
  Priced,
  { name: string; logo: string; plans: Plan[]; url: string; note: string }
> = {
  chromatic: {
    name: "Chromatic",
    logo: "/logos/compare/chromatic.png",
    plans: CHROMATIC,
    url: "https://www.chromatic.com/pricing",
    note: "TurboSnap can lower Chromatic's count.",
  },
  argos: {
    name: "Argos",
    logo: "/logos/compare/argos.png",
    plans: ARGOS,
    url: "https://argos-ci.com/pricing",
    note: "Argos charges $0.0015 for extra Storybook screenshots.",
  },
  percy: {
    name: "Percy",
    logo: "/logos/compare/percy.png",
    plans: PERCY,
    url: "https://www.browserstack.com/pricing?product=percy",
    note: "Percy prices are month to month; yearly billing is lower.",
  },
};

export type Suite = {
  screens: number;
  viewports: number;
  browsers: number;
  builds: number;
};

export const DEFAULT_SUITE: Suite = {
  screens: DEFAULT_WORKLOAD.screens,
  viewports: DEFAULT_WORKLOAD.variants,
  browsers: 1,
  builds: DEFAULT_WORKLOAD.builds,
};

const SLIDERS: {
  key: keyof Suite;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "screens", label: "Stories or pages", min: 10, max: 2000, step: 10 },
  { key: "viewports", label: "Viewports", min: 1, max: 6, step: 1 },
  { key: "browsers", label: "Browsers", min: 1, max: 4, step: 1 },
  { key: "builds", label: "Builds a month", min: 50, max: 3000, step: 50 },
];

export type Bill = {
  name: string;
  logo: string | null;
  plan: string;
  cost: number | null;
};

export function quote(suite: Suite, competitors: Priced[]) {
  const numbers = estimate({
    ...DEFAULT_WORKLOAD,
    screens: suite.screens,
    variants: suite.viewports * suite.browsers,
    builds: suite.builds,
  });
  const ours: Bill = {
    name: "stateofpixel",
    logo: null,
    plan: `${numbers.tier === null ? "Custom" : numbers.tier.plan === "free" ? "Free" : `${numbers.tier.gigabytes} GB`}, ${gigabytes(numbers.stored)} stored`,
    cost: numbers.tier === null ? null : monthlyPrice(numbers.tier, "monthly"),
  };
  const theirs = competitors.map((key): Bill => {
    const { name, logo, plans } = PRICED[key];
    const { plan, cost, extra } = cheapestPlan(
      plans,
      numbers.snapshots,
      suite.browsers,
    );
    return {
      name,
      logo,
      plan:
        extra > 0 && plan.extra !== null
          ? `${plan.name} ${formatPrice(plan.price)} + ${count.format(extra)} extra at ${formatPrice(plan.extra * 1000)} per 1,000`
          : plan.name,
      cost: Math.round(cost),
    };
  });
  return { snapshots: numbers.snapshots, bills: [ours, ...theirs] };
}

export function BillLogo({ bill, size }: { bill: Bill; size: number }) {
  return bill.logo === null ? (
    <Logo size={size} />
  ) : (
    <img
      src={bill.logo}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="flex-none rounded-[22%] ring-1 ring-border"
    />
  );
}

export function CostCalculator({
  competitors,
  flushTop = false,
}: {
  competitors: Priced[];
  flushTop?: boolean;
}) {
  const [suite, setSuite] = useState(DEFAULT_SUITE);
  const { snapshots, bills } = quote(suite, competitors);
  const max = Math.max(...bills.map((bill) => bill.cost ?? 0), 1);
  const [ours, ...theirs] = bills;
  const cheapest = Math.min(...theirs.map((bill) => bill.cost ?? 0));
  const saved =
    ours?.cost === null || ours === undefined ? 0 : cheapest - ours.cost;
  return (
    <section
      id="cost"
      className={`${flushTop ? `${WIDE} pb-24 max-sm:pb-12` : SECTION} scroll-mt-16`}
    >
      <LeadCopy title="Price it for your suite." className="max-w-[720px]">
        Move the sliders. Every tool here bills for this many screenshots a
        month, except stateofpixel.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-[minmax(0,380px)_1fr] gap-4 max-lg:grid-cols-1">
        <div className="flex flex-col gap-6 rounded-lg bg-surface-2 p-6">
          {SLIDERS.map((slider) => (
            <label key={slider.key} className="flex flex-col gap-2 text-sm">
              <span className="flex items-baseline justify-between">
                <span className="text-muted">{slider.label}</span>
                <span className="mono font-medium tabular-nums">
                  {count.format(suite[slider.key])}
                </span>
              </span>
              <RangeSlider
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={suite[slider.key]}
                onChange={(event) =>
                  setSuite({
                    ...suite,
                    [slider.key]: Number(event.target.value),
                  })
                }
                className="w-full"
              />
            </label>
          ))}
          <p className="mt-auto border-t border-dotted border-field-border/50 pt-4 text-sm">
            <span className="block text-xs text-muted">
              Screenshots a month
            </span>
            <span className="text-[32px] leading-tight font-semibold tracking-[-0.04em] tabular-nums">
              {count.format(snapshots)}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-6 rounded-lg bg-surface p-6 ring-1 ring-border">
          {bills.map((bill, index) => (
            <div key={bill.name} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <BillLogo bill={bill} size={24} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${index === 0 ? "font-semibold" : "font-medium"}`}
                  >
                    {bill.name}
                  </span>
                  <span className="block text-xs text-muted">{bill.plan}</span>
                </span>
                <span
                  className={`tabular-nums ${index === 0 ? "text-[32px] leading-none font-semibold tracking-[-0.04em]" : "text-xl font-medium text-muted"}`}
                >
                  {bill.cost === null ? "Contact us" : formatPrice(bill.cost)}
                  <span className="text-xs font-normal tracking-normal text-muted">
                    {" "}
                    /mo
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${index === 0 ? "bg-approved" : "bg-field-border"}`}
                  style={{
                    width: `${Math.max(((bill.cost ?? 0) / max) * 100, 1)}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="mt-auto border-t border-dotted border-field-border/50 pt-4 text-sm text-muted">
            {saved > 0 ? (
              <>
                <span className="font-semibold text-approved tabular-nums">
                  {formatPrice(Math.round(saved * 12))}
                </span>{" "}
                a year less than{" "}
                {theirs.length > 1 ? "the cheapest of them" : theirs[0]?.name}.
              </>
            ) : saved === 0 ? (
              "At this size, every plan here is free."
            ) : (
              "At this size, stateofpixel costs more. Storage is the only thing that grows the bill."
            )}
          </p>
        </div>
      </div>
      <p className="mt-6 max-w-[90ch] text-xs text-muted">
        Screenshots are stories x viewports x browsers x builds. For
        stateofpixel, {DEFAULT_WORKLOAD.changed}% of screenshots change per
        build at {DEFAULT_WORKLOAD.kilobytes} KB each, and pull request images
        are kept {facts.retentionDays} days. The cheapest list plan for each
        tool, before tax, from{" "}
        {competitors.map((key, index) => (
          <span key={key}>
            {index > 0 && ", "}
            <a href={PRICED[key].url} className="text-link">
              {PRICED[key].name} pricing
            </a>
          </span>
        ))}{" "}
        on {CHECKED}. {competitors.map((key) => PRICED[key].note).join(" ")}
      </p>
    </section>
  );
}
