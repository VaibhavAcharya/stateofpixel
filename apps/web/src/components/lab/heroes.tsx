import { ArrowRightIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";
import { useReducedMotion } from "../../lib/useTicker";
import { BillLogo } from "../compare/CostCalculator";
import { MEDIAN_UPLOAD } from "../landing/Numbers";
import { formatPrice } from "../landing/Pricing";
import { ReviewDemo } from "../landing/ReviewDemo";
import { DISPLAY, LEAD, WIDE } from "../landing/sections";
import { AuthButton } from "../SignIn";
import { buttonClass } from "../ui";
import { HeroChecksLive, LabHero } from "./landing";
import { count, FREE_TIER, monthlyBills } from "./numbers";

const COMMAND = "npx stateofpixel upload screenshots";

const OUTPUT = [
  "stateofpixel  build #412  pricing-cards vs main (#405)",
  "  1,488 snapshots  1,478 unchanged  8 changed  2 added  0 removed",
  `  uploaded 10 images (0.8 MB) in ${MEDIAN_UPLOAD.toFixed(1)} s`,
  "  review: https://stateofpixel.com/acme/web/builds/412",
];

/* Diff slider */

export function DiffSliderArt() {
  const [split, setSplit] = useState(50);
  const [diff, setDiff] = useState(true);
  return (
    <figure className="w-[560px] overflow-hidden rounded-lg bg-surface shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm">
        <span className="font-medium">
          <span className="text-muted">Pricing/</span>Cards
        </span>
        <span className="rounded-xs bg-changed-bg px-1.5 text-2xs font-medium text-changed">
          changed
        </span>
        <button
          type="button"
          aria-pressed={diff}
          onClick={() => setDiff(!diff)}
          className={`${buttonClass("ghost", "sm")} ml-auto`}
        >
          Diff overlay {diff ? "on" : "off"}
        </button>
      </div>
      <div className="checker relative aspect-[600/375]">
        <img
          src="/demo/pricing-base.png"
          alt="Baseline"
          className="absolute inset-0 size-full"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        >
          <img
            src="/demo/pricing-new.png"
            alt="New"
            className="absolute inset-0 size-full"
          />
          {diff && (
            <img
              src="/demo/pricing-diff.png"
              alt=""
              className="absolute inset-0 size-full opacity-70"
            />
          )}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-link"
          style={{ left: `${split}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label="Baseline and new split"
          onChange={(event) => setSplit(Number(event.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="flex justify-between border-t border-border px-4 py-2 text-xs text-muted">
        <span>Baseline</span>
        <span>Drag to compare</span>
        <span>New</span>
      </figcaption>
    </figure>
  );
}

/* Terminal */

export function TerminalArt() {
  const reduced = useReducedMotion();
  const total = COMMAND.length + OUTPUT.length * 6 + 20;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) {
      return;
    }
    const timer = window.setInterval(
      () => setTick((current) => (current + 1) % total),
      60,
    );
    return () => window.clearInterval(timer);
  }, [reduced, total]);
  const step = reduced ? total - 1 : tick;
  const typed = COMMAND.slice(0, step);
  const lines = OUTPUT.slice(
    0,
    Math.max(0, Math.floor((step - COMMAND.length) / 6)),
  );
  return (
    <div className="w-[560px] overflow-hidden rounded-lg bg-[#0a0a0a] font-mono text-[13px] leading-[1.8] text-[#ededed] shadow-[0_8px_32px_#11151a30] ring-1 ring-[#2e2e2e]">
      <div className="flex h-9 items-center gap-1.5 border-b border-[#2e2e2e] px-3">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-2.5 rounded-full bg-[#2e2e2e]" />
        ))}
        <span className="ml-2 text-xs text-[#a1a1a1]">
          .github/workflows/visual.yml
        </span>
      </div>
      <pre className="h-[188px] overflow-hidden p-4 whitespace-pre-wrap">
        <span className="text-[#a1a1a1]">$ </span>
        {typed}
        {step < COMMAND.length && (
          <span className="ml-px inline-block h-4 w-2 translate-y-0.5 bg-[#ededed]" />
        )}
        {lines.map((line) => (
          <span
            key={line}
            className={`block ${line.includes("changed") ? "" : "text-[#a1a1a1]"}`}
          >
            {line}
          </span>
        ))}
      </pre>
    </div>
  );
}

export function CommandChip() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(COMMAND).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="mt-4 inline-flex h-9 items-center gap-3 rounded-control bg-surface-2 px-3 font-mono text-[13px] ring-1 ring-border hover:bg-hover"
    >
      <span className="text-muted">$</span>
      {COMMAND}
      {copied ? (
        <CheckIcon size={14} className="text-approved" />
      ) : (
        <CopyIcon size={14} className="text-muted" />
      )}
    </button>
  );
}

export function TerminalHero() {
  return (
    <LabHero
      headline="One line in CI. Every pixel reviewed."
      lead={
        <>
          Add the upload step after your tests. We compare, show the diffs and
          set the GitHub check.{" "}
          <strong className="font-semibold text-text">
            No token on GitHub Actions.
          </strong>
        </>
      }
      proof={<CommandChip />}
      art={<TerminalArt />}
    />
  );
}

/* Bill */

export function BillArt() {
  const { snapshots, bills } = monthlyBills();
  return (
    <div className="w-[480px] overflow-hidden rounded-lg bg-surface shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold">Your visual tests, one month</p>
        <p className="text-xs text-muted">
          {count.format(snapshots)} screenshots, cheapest list plan
        </p>
      </div>
      <ul className="divide-y divide-border">
        {bills.map((bill, index) => (
          <li key={bill.name} className="flex items-center gap-3 px-5 py-4">
            <BillLogo bill={bill} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{bill.name}</span>
              <span className="block text-xs text-muted">{bill.plan}</span>
            </span>
            <span
              className={`tabular-nums ${index === 0 ? "text-[36px] leading-none font-semibold tracking-[-0.04em] text-approved" : "text-2xl font-medium text-muted"}`}
            >
              {formatPrice(bill.cost ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BillHero() {
  return (
    <LabHero
      headline="Same visual review. A $0 bill."
      lead={
        <>
          Your CI takes the screenshots, so we don't bill for them. Diffs,
          review and the GitHub check are included.{" "}
          <strong className="font-semibold text-text">
            Pay only past {FREE_TIER?.gigabytes ?? 10} GB of storage.
          </strong>
        </>
      }
      art={<BillArt />}
    />
  );
}

/* Product first */

export function ProductFirstHero() {
  return (
    <section className="pt-24 max-sm:pt-12">
      <div className={`${WIDE} text-center`}>
        <h1 className={`${DISPLAY} mx-auto max-w-[20ch]`}>
          See every pixel your pull request changes.
        </h1>
        <p className={`${LEAD} mx-auto mt-6 max-w-[640px]`}>
          Screenshots from your CI, a review page you drive with the keyboard,
          and a GitHub check. Free up to 10 GB.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <AuthButton label="Start free with GitHub" />
          <span className="text-xs text-muted">
            Try it below: j, k, a and r work.
          </span>
        </div>
      </div>
      <div className={`${WIDE} mt-16 pb-16`}>
        <div className="checker rounded-xl p-12 ring-1 ring-border max-md:p-3">
          <div className="mx-auto max-w-[1180px]">
            <ReviewDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

/* Ink */

export function InkHero() {
  return (
    <section className="bg-[#000] text-[#ededed]">
      <div
        className={`${WIDE} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-12 pt-24 pb-24 max-lg:grid-cols-1 max-sm:pt-12`}
      >
        <div>
          <h1 className={`${DISPLAY} max-w-[16ch]`}>
            The visual check for fast teams.
          </h1>
          <p className="mt-6 max-w-[640px] text-2xl font-[450] tracking-[-0.035em] text-balance text-[#a1a1a1] max-sm:text-xl">
            Your CI renders, the upload takes {MEDIAN_UPLOAD.toFixed(1)}{" "}
            seconds, and you approve with one key.{" "}
            <strong className="font-semibold text-[#ededed]">
              No per-screenshot bill.
            </strong>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-control bg-[#ededed] px-3 text-sm font-medium text-[#0a0a0a]">
              Start free with GitHub
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-[#a1a1a1] ring-1 ring-[#2e2e2e]">
              Try the review page
              <ArrowRightIcon size={14} />
            </span>
          </div>
        </div>
        <div aria-hidden className="text-text max-lg:hidden">
          <HeroChecksLive />
        </div>
      </div>
    </section>
  );
}

/* Stats */

export function StatsHero() {
  const { snapshots, bills } = monthlyBills();
  const cheapest = bills
    .slice(1)
    .reduce((best, bill) =>
      (bill.cost ?? Number.POSITIVE_INFINITY) <
      (best.cost ?? Number.POSITIVE_INFINITY)
        ? bill
        : best,
    );
  const stats: [string, string][] = [
    [formatPrice(0), "for 10 GB, unlimited screenshots"],
    [`${MEDIAN_UPLOAD.toFixed(1)} s`, "median upload on our own CI"],
    ["0", "browsers we run for you"],
    [
      formatPrice(cheapest.cost ?? 0),
      `a month on ${cheapest.name} for ${count.format(snapshots)} screenshots`,
    ],
  ];
  return (
    <section className={`${WIDE} pt-24 pb-16 max-sm:pt-12`}>
      <h1 className={`${DISPLAY} max-w-[18ch]`}>
        Visual regression testing, minus the bill.
      </h1>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <AuthButton label="Start free with GitHub" />
        <a href="#demo" className={buttonClass("secondary")}>
          Try the review page
          <ArrowRightIcon size={14} className="text-muted" />
        </a>
      </div>
      <dl className="mt-16 grid grid-cols-4 border-t border-dotted border-field-border/50 max-md:grid-cols-2">
        {stats.map(([value, label], index) => (
          <div
            key={label}
            className="flex flex-col-reverse justify-end border-b border-dotted border-field-border/50 py-6 pr-6"
          >
            <dt className="mt-2 text-sm text-muted">{label}</dt>
            <dd
              className={`text-[48px] leading-none font-semibold tracking-[-0.045em] tabular-nums ${index === 3 ? "text-muted" : ""}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
