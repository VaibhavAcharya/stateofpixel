import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useState } from "react";
import { CHECKED } from "../../content/compare";
import { track } from "../../lib/analytics";
import {
  ARGOS,
  CHROMATIC,
  PERCY,
  type Plan,
} from "../../lib/competitorPricing";
import { useTicker } from "../../lib/useTicker";
import { BillLogo, DEFAULT_SUITE, quote } from "../compare/CostCalculator";
import { LeadCopy } from "../ui";
import { formatPrice } from "./Pricing";
import { SECTION } from "./sections";

const DOTTED = "border-dotted border-field-border/50";

const count = new Intl.NumberFormat("en-US");

const OUR_UPLOADS: [number, number][] = [
  [1.3, 0],
  [1.9, 0],
  [1.7, 0],
  [1.5, 0],
  [1.3, 0],
  [1.0, 0],
  [1.2, 0],
  [1.1, 0],
  [1.1, 0],
  [1.2, 0],
  [1.6, 0],
  [1.4, 0],
  [1.6, 0],
  [1.8, 0],
  [1.4, 0],
  [1.2, 0],
  [1.0, 0],
  [1.3, 0],
  [1.6, 0],
  [1.5, 0],
  [1.1, 0],
  [1.8, 4],
  [1.7, 0],
  [1.4, 0],
  [2.3, 4],
  [1.3, 0],
  [1.2, 0],
  [0.9, 0],
  [0.8, 0],
  [3.9, 12],
  [1.2, 0],
  [1.0, 0],
  [1.5, 0],
  [1.0, 0],
  [0.9, 0],
  [1.4, 0],
  [1.3, 0],
  [0.9, 0],
  [0.8, 0],
  [1.5, 0],
  [1.7, 0],
  [1.1, 0],
  [1.4, 0],
  [1.9, 4],
  [2.3, 2],
  [1.5, 0],
  [1.1, 0],
  [0.8, 0],
  [1.1, 0],
  [0.7, 0],
];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export const MEDIAN_UPLOAD = median(OUR_UPLOADS.map(([seconds]) => seconds));

function overage(plans: Plan[]) {
  return plans.find((plan) => plan.extra !== null)?.extra ?? 0;
}

const PER_THOUSAND = [
  { name: "Percy", logo: "/logos/compare/percy.png", plans: PERCY },
  { name: "Chromatic", logo: "/logos/compare/chromatic.png", plans: CHROMATIC },
  { name: "Argos", logo: "/logos/compare/argos.png", plans: ARGOS },
].map((rival) => ({ ...rival, cost: overage(rival.plans) * 1000 }));

export function PerThousandSection() {
  return (
    <section className={SECTION}>
      <LeadCopy
        title="What 1,000 more screenshots cost."
        className="max-w-[720px]"
      >
        Past the plan limit, other tools bill each screenshot. We don't count
        them.
      </LeadCopy>
      <dl
        className={`mt-12 grid grid-cols-4 border-t ${DOTTED} max-md:grid-cols-2`}
      >
        <div className={`border-b ${DOTTED} py-6 pr-6`}>
          <dt className="flex items-center gap-2 text-sm font-medium">
            <BillLogo
              bill={{ name: "", logo: null, plan: "", cost: 0 }}
              size={20}
            />
            stateofpixel
          </dt>
          <dd className="mt-3 text-[56px] leading-none font-semibold tracking-[-0.045em] text-approved tabular-nums">
            $0
          </dd>
        </div>
        {PER_THOUSAND.map((rival) => (
          <div key={rival.name} className={`border-b ${DOTTED} py-6 pr-6`}>
            <dt className="flex items-center gap-2 text-sm text-muted">
              <img
                src={rival.logo}
                alt=""
                width={20}
                height={20}
                className="rounded-[22%] ring-1 ring-border"
              />
              {rival.name}
            </dt>
            <dd className="mt-3 text-[56px] leading-none font-semibold tracking-[-0.045em] text-muted tabular-nums">
              {formatPrice(rival.cost)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-xs text-muted">
        Overage rate on each tool's first paid plan, list price before tax,
        checked on {CHECKED}. Argos bills Storybook screenshots at a lower rate.
      </p>
    </section>
  );
}

export function CostSection() {
  const [screens, setScreens] = useState(DEFAULT_SUITE.screens);
  const { snapshots, bills } = quote({ ...DEFAULT_SUITE, screens }, [
    "argos",
    "chromatic",
    "percy",
  ]);
  const max = Math.max(...bills.map((bill) => bill.cost ?? 0), 1);
  return (
    <section
      className={`${SECTION} grid grid-cols-[1fr_1.2fr] gap-12 max-lg:grid-cols-1`}
    >
      <div>
        <LeadCopy title="How big is your suite?" className="max-w-[520px]">
          Drag it. {DEFAULT_SUITE.viewports} viewports and{" "}
          {DEFAULT_SUITE.builds} builds a month.
        </LeadCopy>
        <label className="mt-10 flex flex-col gap-3">
          <span className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Stories or pages</span>
            <span className="text-[32px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
              {count.format(screens)}
            </span>
          </span>
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={screens}
            onChange={(event) => setScreens(Number(event.target.value))}
            onPointerUp={() => track("Suite slider", { screens })}
            onKeyUp={() => track("Suite slider", { screens })}
            className="w-full accent-(--color-text)"
          />
          <span className="text-xs text-muted tabular-nums">
            {count.format(snapshots)} screenshots a month.{" "}
            <a href="/compare#cost" className="text-link">
              Change viewports, browsers and builds
            </a>
          </span>
        </label>
      </div>
      <ul className="flex flex-col gap-5">
        {bills.map((bill, index) => (
          <li
            key={bill.name}
            className="grid grid-cols-[140px_1fr_120px] items-center gap-4 max-sm:grid-cols-[96px_1fr_88px]"
          >
            <span className="flex items-center gap-2 text-sm">
              <BillLogo bill={bill} size={20} />
              <span className={index === 0 ? "font-medium" : "text-muted"}>
                {bill.name}
              </span>
            </span>
            <span className="h-8 rounded-sm bg-surface-2">
              <span
                className={`block h-full rounded-sm transition-[width] duration-180 ${index === 0 ? "bg-approved" : "bg-field-border/50"}`}
                style={{
                  width: `${Math.max(((bill.cost ?? 0) / max) * 100, 0.5)}%`,
                }}
              />
            </span>
            <span
              className={`text-right tabular-nums ${index === 0 ? "text-xl font-semibold" : "text-base text-muted"}`}
            >
              {bill.cost === null ? "Custom" : `${formatPrice(bill.cost)}/mo`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FigureFrame({
  label,
  title,
  text,
  children,
}: {
  label: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <figure className={`flex flex-col border-t ${DOTTED} pt-6`}>
      <span className="mono text-xs text-muted">{label}</span>
      <div
        aria-hidden
        className="mt-6 flex h-40 items-center justify-center rounded-lg bg-surface-2"
      >
        {children}
      </div>
      <figcaption className="mt-6">
        <span className="block text-xl font-semibold tracking-[-0.025em]">
          {title}
        </span>
        <span className="mt-2 block text-sm text-muted">{text}</span>
      </figcaption>
    </figure>
  );
}

const HASHES = ["a3f9c2", "7b21e0", "c0ffee", "91d4ab", "e5e5e5"];

function HashArt() {
  const step = useTicker(HASHES.length + 1, 700);
  return (
    <div className="flex flex-col gap-1.5">
      {HASHES.map((hash, index) => {
        const lit = step > index;
        return (
          <span
            key={hash}
            className={`flex w-52 items-center gap-2 rounded-sm px-2 py-1 text-xs transition-colors duration-180 ${lit ? "bg-surface" : ""}`}
          >
            <span className="mono text-muted">{hash}</span>
            <span className="ml-auto">
              {lit &&
                (index === 2 ? (
                  <span className="text-changed">upload 84 KB</span>
                ) : (
                  <span className="text-muted">seen, skip</span>
                ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}

const KEY_SCRIPT = ["j", "a", "j", "a", "j", "r"];

function KeysArt() {
  const step = useTicker(KEY_SCRIPT.length, 650);
  return (
    <div className="flex gap-2">
      {["j", "k", "a", "r"].map((key) => (
        <span
          key={key}
          className={`mono flex size-12 items-center justify-center rounded-md text-lg transition-all duration-100 ${KEY_SCRIPT[step] === key ? "translate-y-0.5 bg-accent text-accent-fg" : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-border),0_2px_0_var(--color-border)]"}`}
        >
          {key}
        </span>
      ))}
    </div>
  );
}

function RunnerArt() {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="rounded-md bg-surface px-3 py-2 ring-1 ring-border">
        Your CI
        <span className="block text-muted">renders once</span>
      </span>
      <ArrowRightIcon size={14} className="text-muted" />
      <span className="rounded-md bg-surface px-3 py-2 ring-1 ring-border">
        stateofpixel
        <span className="block text-muted">renders never</span>
      </span>
    </div>
  );
}

export function SpeedSection() {
  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <LeadCopy title="Nothing to wait for." className="max-w-[640px]">
          No render queue, no upload of what we have seen, no mouse needed.
        </LeadCopy>
        <p className="text-right max-sm:text-left">
          <span className="block text-[56px] leading-none font-semibold tracking-[-0.045em] tabular-nums">
            {MEDIAN_UPLOAD.toFixed(1)} s
          </span>
          <span className="text-xs text-muted">
            median of {OUR_UPLOADS.length} uploads on our own CI
          </span>
        </p>
      </div>
      <div className="mt-12 grid grid-cols-3 gap-8 max-lg:grid-cols-1">
        <FigureFrame
          label="Fig 0.1"
          title="Nothing renders twice."
          text="Your tests already took the screenshots. There is no second browser to wait for."
        >
          <RunnerArt />
        </FigureFrame>
        <FigureFrame
          label="Fig 0.2"
          title="Unchanged costs one hash."
          text="The CLI hashes every screenshot and uploads only the ones we have not seen."
        >
          <HashArt />
        </FigureFrame>
        <FigureFrame
          label="Fig 0.3"
          title="One key per decision."
          text="j and k to move, a to approve, r to reject. The whole review page works without a mouse."
        >
          <KeysArt />
        </FigureFrame>
      </div>
    </section>
  );
}
