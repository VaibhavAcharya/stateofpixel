import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  GitPullRequestIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTicker } from "../../lib/useTicker";
import { BillLogo } from "../compare/CostCalculator";
import { MEDIAN_UPLOAD } from "../landing/Numbers";
import { formatPrice } from "../landing/Pricing";
import { DISPLAY, LEAD, SECTION, WIDE } from "../landing/sections";
import { AuthButton } from "../SignIn";
import { buttonClass, Kbd } from "../ui";
import { count, FREE_TIER, monthlyBills, tierReach } from "./numbers";

/* Hero */

function AnnouncementPill() {
  return (
    <Link
      to="/docs/$slug"
      params={{ slug: "storybook" }}
      className="group inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-xs text-muted hover:text-text"
    >
      <span className="rounded-full bg-surface px-2 py-0.5 font-medium text-text ring-1 ring-border">
        New
      </span>
      Storybook capture runs 4 stories at a time
      <ArrowRightIcon
        size={12}
        className="transition-transform duration-100 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

export function PriceLine() {
  const { snapshots, bills } = monthlyBills();
  return (
    <div className="mt-8 max-w-[640px] rounded-lg bg-surface-2 p-4">
      <p className="text-xs text-muted">
        {count.format(snapshots)} screenshots a month, cheapest list plan
      </p>
      <ul className="mt-3 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
        {bills.map((bill, index) => (
          <li key={bill.name} className="flex items-center gap-2">
            <BillLogo bill={bill} size={20} />
            <span
              className={`tabular-nums ${index === 0 ? "text-xl font-semibold text-approved" : "text-base text-muted"}`}
            >
              {formatPrice(bill.cost ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LabHero({
  headline,
  lead,
  pill = false,
  proof,
  art,
}: {
  headline: string;
  lead: ReactNode;
  pill?: boolean;
  proof?: ReactNode;
  art: ReactNode;
}) {
  return (
    <section
      className={`${WIDE} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-12 pt-24 pb-16 max-lg:grid-cols-1 max-sm:pt-12`}
    >
      <div>
        {pill && (
          <p className="mb-6">
            <AnnouncementPill />
          </p>
        )}
        <h1 className={`${DISPLAY} max-w-[16ch]`}>{headline}</h1>
        <p className={`${LEAD} mt-6 max-w-[640px]`}>{lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AuthButton label="Start free with GitHub" />
          <a href="#demo" className={buttonClass("secondary")}>
            Try the review page
            <ArrowRightIcon size={14} className="text-muted" />
          </a>
        </div>
        {proof ?? (
          <p className="mt-4 text-xs text-muted">
            Free up to 10 GB. No card. Playwright, Storybook or any folder of
            PNGs.
          </p>
        )}
      </div>
      <div aria-hidden className="max-lg:hidden">
        {art}
      </div>
    </section>
  );
}

export function PriceHero({ art }: { art: ReactNode }) {
  return (
    <LabHero
      headline="Visual regression testing without the snapshot bill."
      lead={
        <>
          Your CI already takes the screenshots. We compare them, show every
          diff and set the GitHub check.{" "}
          <strong className="font-semibold text-text">
            Unlimited screenshots, free up to 10 GB.
          </strong>
        </>
      }
      proof={<PriceLine />}
      art={art}
    />
  );
}

export function SpeedHero({ art }: { art: ReactNode }) {
  return (
    <LabHero
      pill
      headline="Visual review at the speed of your keyboard."
      lead={
        <>
          Screenshots from your CI, diffs you move through with <Kbd>j</Kbd> and
          approve with <Kbd>a</Kbd>, and a GitHub check that turns green.{" "}
          <strong className="font-semibold text-text">
            Uploads take {MEDIAN_UPLOAD.toFixed(1)} seconds on our own CI.
          </strong>
        </>
      }
      art={art}
    />
  );
}

export function AgentsHero({ art }: { art: ReactNode }) {
  return (
    <LabHero
      headline="Your agents write the UI. You approve the pixels."
      lead={
        <>
          Every pull request gets a visual check. Your CI takes the screenshots,
          a person approves each change, and the check turns green.{" "}
          <strong className="font-semibold text-text">Free up to 10 GB.</strong>
        </>
      }
      art={art}
    />
  );
}

export function ZeroHero({ art }: { art: ReactNode }) {
  const free = tierReach(FREE_TIER?.gigabytes ?? 10);
  return (
    <LabHero
      headline="Visual testing for $0 a month."
      lead={
        <>
          The free plan stores 10 GB, about{" "}
          {count.format(Math.round(free.snapshots / 1000) * 1000)} screenshots a
          month when 5% of them change.{" "}
          <strong className="font-semibold text-text">
            No card, no per-screenshot bill.
          </strong>
        </>
      }
      art={art}
    />
  );
}

/* Animated check */

const CHANGES = 5;

export function HeroChecksLive() {
  const step = useTicker(CHANGES + 3, 900);
  const approved = Math.min(Math.max(step - 1, 0), CHANGES);
  const done = approved === CHANGES;
  const checks = [
    { name: "ci/lint", title: "Successful in 41s", done: true },
    { name: "ci/test", title: "Successful in 2m", done: true },
    {
      name: "stateofpixel/playwright",
      title: done
        ? `${CHANGES} changes approved`
        : `${CHANGES - approved} changes to review`,
      done,
    },
  ];
  return (
    <div className="w-[560px] overflow-hidden rounded-lg bg-surface shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GitPullRequestIcon size={18} className="text-approved" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">
            Tighten pricing cards <span className="text-muted">#412</span>
          </span>
          <span className="block text-xs text-muted">
            <span className="mono">pricing-cards</span> into{" "}
            <span className="mono">main</span>
          </span>
        </span>
      </div>
      <ul className="divide-y divide-border">
        {checks.map((check) => (
          <li key={check.name} className="flex items-center gap-3 px-4 py-3">
            {check.done ? (
              <CheckCircleIcon
                size={18}
                weight="fill"
                className="text-approved"
              />
            ) : (
              <CircleIcon size={18} weight="bold" className="text-pending" />
            )}
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{check.name}</span>
              <span className="text-muted tabular-nums"> {check.title}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-1 border-t border-border px-4 py-3">
        {Array.from({ length: CHANGES }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed length
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-250 ${index < approved ? "bg-approved" : "bg-surface-2"}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-bg px-4 py-3">
        <span className="text-xs text-muted">
          {done ? "Ready to merge" : "Merges when every change is approved"}
        </span>
        <span
          className={`${buttonClass("primary")} ml-auto transition-opacity duration-250 ${done ? "" : "opacity-45"}`}
        >
          Merge
        </span>
      </div>
    </div>
  );
}

/* Keyboard */

const SCRIPT: { key: string; label: string }[] = [
  { key: "j", label: "Next change" },
  { key: "a", label: "Approve" },
  { key: "j", label: "Next change" },
  { key: "3", label: "Slider view" },
  { key: "a", label: "Approve" },
  { key: "j", label: "Next change" },
  { key: "r", label: "Reject" },
];

const ROWS = ["Header/Default", "Pricing/Cards", "Buttons/Primary"];

export function KeyboardSection() {
  const step = useTicker(SCRIPT.length + 1, 900);
  const done = SCRIPT.slice(0, step);
  const decisions = done
    .filter((entry) => entry.key === "a" || entry.key === "r")
    .map((entry) => entry.key);
  const selected = Math.min(
    Math.max(done.filter((entry) => entry.key === "j").length - 1, 0),
    ROWS.length - 1,
  );
  const last = done[done.length - 1];
  return (
    <section className="bg-accent text-accent-fg">
      <div
        className={`${SECTION} grid grid-cols-[1fr_1fr] items-center gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <p className="text-2xl font-[450] tracking-[-0.035em] text-balance opacity-70 max-sm:text-xl">
            <strong className="font-semibold opacity-100">
              Review a build without touching the mouse.
            </strong>{" "}
            Every action on the review page has a key, printed next to its
            button.
          </p>
          <p className="mt-10 flex h-16 items-center gap-4">
            {last && (
              <>
                <span className="mono flex size-16 items-center justify-center rounded-lg bg-accent-fg text-2xl text-accent">
                  {last.key}
                </span>
                <span className="text-xl font-medium">{last.label}</span>
              </>
            )}
          </p>
        </div>
        <ul className="flex flex-col gap-1 rounded-lg bg-accent-fg/10 p-2">
          {ROWS.map((row, index) => {
            const decision = decisions[index];
            return (
              <li
                key={row}
                className={`flex h-10 items-center gap-3 rounded-sm px-3 text-sm ${index === selected && step > 0 ? "bg-accent-fg/15" : ""}`}
              >
                {decision === "a" ? (
                  <CheckIcon
                    size={16}
                    weight="bold"
                    className="text-approved"
                  />
                ) : decision === "r" ? (
                  <XIcon size={16} weight="bold" className="text-rejected" />
                ) : (
                  <CircleIcon size={16} className="opacity-60" />
                )}
                <span className="mono">{row}</span>
                <span className="ml-auto text-xs opacity-60">
                  {decision === "a"
                    ? "approved"
                    : decision === "r"
                      ? "rejected"
                      : "pending"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
