import { useState } from "react";
import { LeadCopy } from "../ui";
import {
  DEFAULT_WORKLOAD,
  estimate,
  formatPrice,
  monthlyPrice,
  type Workload,
} from "./Pricing";
import { SECTION } from "./sections";

const count = new Intl.NumberFormat("en-US");

const MEDIUM = { label: "Medium", workload: DEFAULT_WORKLOAD };

const TEAMS: { label: string; workload: Workload }[] = [
  {
    label: "Small",
    workload: { ...DEFAULT_WORKLOAD, screens: 100, variants: 2, builds: 200 },
  },
  MEDIUM,
  {
    label: "Large",
    workload: { ...DEFAULT_WORKLOAD, screens: 1000, variants: 4, builds: 1000 },
  },
];

function describe(workload: Workload) {
  return `${count.format(workload.screens)} stories, ${workload.variants} viewports, ${count.format(workload.builds)} builds a month`;
}

function ours(numbers: ReturnType<typeof estimate>) {
  return numbers.tier === null ? null : monthlyPrice(numbers.tier, "monthly");
}

function CostFootnote() {
  return (
    <p className="mt-6 max-w-[90ch] text-xs text-muted">
      {DEFAULT_WORKLOAD.changed}% of snapshots change per build,{" "}
      {DEFAULT_WORKLOAD.kilobytes} KB per screenshot, pull request images kept
      60 days. Stored size counts each changed screenshot and its diff once.
      Chromatic and Argos list prices from{" "}
      <a href="https://www.chromatic.com/pricing" className="text-link">
        chromatic.com/pricing
      </a>{" "}
      and{" "}
      <a href="https://argos-ci.com/pricing" className="text-link">
        argos-ci.com/pricing
      </a>{" "}
      on 25 September 2026, before tax. Their TurboSnap and Storybook rates can
      lower the count.
    </p>
  );
}

export function CostSection() {
  const [team, setTeam] = useState(MEDIUM);
  const numbers = estimate(team.workload);
  const price = ours(numbers) ?? 0;
  const rows: [string, number, boolean][] = [
    ["stateofpixel", price, true],
    ["Argos", numbers.argos, false],
    ["Chromatic", numbers.chromatic, false],
  ];
  const max = Math.max(...rows.map(([, value]) => value));
  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <LeadCopy
          title="Same review, a fraction of the bill."
          className="max-w-[640px]"
        >
          {describe(team.workload)}, {count.format(numbers.snapshots)}{" "}
          snapshots.
        </LeadCopy>
        <div className="flex items-center gap-3">
          <span id="team-size" className="text-sm text-muted">
            Team size
          </span>
          <fieldset
            aria-labelledby="team-size"
            className="flex gap-1 rounded-control bg-surface-2 p-0.5"
          >
            {TEAMS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={option === team}
                onClick={() => setTeam(option)}
                className={`h-7 rounded-sm px-3 text-xs font-medium transition-colors duration-100 ${
                  option === team
                    ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                    : "text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        </div>
      </div>
      <dl className="mt-12 flex flex-col gap-5">
        {rows.map(([name, value, highlight]) => (
          <div
            key={name}
            className="grid grid-cols-[140px_1fr_120px] items-center gap-4 max-sm:grid-cols-[96px_1fr_88px]"
          >
            <dt
              className={`text-sm ${highlight ? "font-medium" : "text-muted"}`}
            >
              {name}
            </dt>
            <div className="h-8 rounded-sm bg-surface-2">
              <div
                className={`h-full rounded-sm ${highlight ? "bg-approved" : "bg-field-border/50"}`}
                style={{ width: `${Math.max((value / max) * 100, 0.5)}%` }}
              />
            </div>
            <dd
              className={`text-right tabular-nums ${highlight ? "text-xl font-semibold" : "text-base text-muted"}`}
            >
              {formatPrice(value)}/mo
            </dd>
          </div>
        ))}
      </dl>
      <CostFootnote />
    </section>
  );
}

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

export function SpeedSection() {
  const times = OUR_UPLOADS.map(([seconds]) => seconds);
  const longest = Math.max(...times);
  const empty = OUR_UPLOADS.filter(([, images]) => images === 0).length;
  return (
    <section
      className={`${SECTION} grid grid-cols-[1fr_1.3fr] items-end gap-12 max-lg:grid-cols-1`}
    >
      <div>
        <LeadCopy title="Measured on our own CI." className="max-w-[520px]">
          stateofpixel reviews its own pull requests. This is its upload step.
        </LeadCopy>
        <dl className="mt-10 grid grid-cols-2 gap-6">
          <div>
            <dt className="text-xs text-muted">Median upload</dt>
            <dd className="text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
              {median(times).toFixed(1)} s
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Sent no images</dt>
            <dd className="text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
              {empty} of {OUR_UPLOADS.length}
            </dd>
          </div>
        </dl>
      </div>
      <figure>
        <div className="flex h-32 items-end gap-[3px]" aria-hidden>
          {OUR_UPLOADS.map(([seconds, images], index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed data
              key={index}
              title={`${seconds} s, ${images} images`}
              className={`flex-1 rounded-t-xs ${images === 0 ? "bg-field-border/60" : "bg-changed"}`}
              style={{ height: `${(seconds / longest) * 100}%` }}
            />
          ))}
        </div>
        <figcaption className="mt-3 text-xs text-muted">
          {OUR_UPLOADS.length} uploads from the last 20 runs of our Visual
          workflow on GitHub Actions, 2 to 14 snapshots each, read on 26
          September 2026. Orange bars uploaded images.
        </figcaption>
      </figure>
    </section>
  );
}
