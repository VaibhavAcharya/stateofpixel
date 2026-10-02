import {
  ArrowCounterClockwiseIcon,
  CircleIcon,
  CloudArrowUpIcon,
  GitPullRequestIcon,
  HashIcon,
  SquareSplitHorizontalIcon,
} from "@phosphor-icons/react/ssr";
import { toStatus } from "@stateofpixel/backend/checkStatus";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion";
import { buttonClass, LeadCopy, TONE_TEXT } from "../ui";
import { SECTION } from "./sections";

const OUR_UPLOADS: [number, number][] = [
  [1.8, 0],
  [2.5, 0],
  [2.1, 0],
  [1.5, 0],
  [1.5, 0],
  [3.7, 0],
  [1.6, 0],
  [9.5, 0],
  [2.0, 0],
  [1.9, 0],
  [1.9, 0],
  [2.3, 0],
  [2.4, 0],
  [2.6, 2],
  [33.7, 0],
  [1.2, 0],
  [1.4, 0],
  [1.5, 0],
  [1.3, 0],
  [1.0, 0],
  [1.7, 0],
];

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export const MEDIAN_UPLOAD = median(OUR_UPLOADS.map(([seconds]) => seconds));

const TESTS_MS = 600;
const UPLOAD_MS = MEDIAN_UPLOAD * 1000;
const AXIS = Math.ceil(MEDIAN_UPLOAD);
const TICKS = Array.from({ length: AXIS * 2 + 1 }, (_, index) => index / 2);
const RUN_MS = TESTS_MS + UPLOAD_MS + 600;

const CHECK = toStatus({
  status: "finalized",
  conclusion: "changes",
  counts: {
    unchanged: 1488,
    changed: 10,
    added: 2,
    removed: 1,
    failed: 0,
    pending: 12,
    approved: 0,
    rejected: 0,
  },
  shardsTotal: 1,
  doneShardIndexes: [1],
  storageBlocked: false,
  baselineBuildId: "baseline",
  autoApproved: false,
});

const UPLOAD_STEPS = [
  {
    icon: HashIcon,
    title: "Hash every PNG",
    text: "SHA-256 of each screenshot, on your runner.",
  },
  {
    icon: CloudArrowUpIcon,
    title: "Upload new images",
    text: "Hashes we have seen get no upload.",
  },
  {
    icon: SquareSplitHorizontalIcon,
    title: "Compare",
    text: "The CLI diffs each change against the baseline.",
  },
  {
    icon: GitPullRequestIcon,
    title: "Report the check",
    text: "The pull request gets a check with the review link.",
  },
];

const HOSTED_STEPS = [
  "Upload the build",
  "Wait in a queue",
  "Render in their browsers",
  "Compare",
  "Report the check",
];

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, seen] as const;
}

function useElapsed(active: boolean, total: number) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || reduced) {
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(time) {
      const next = Math.min(Math.max(time - started, 1), total);
      setElapsed(next);
      if (next < total) {
        frame = requestAnimationFrame(tick);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, reduced, total]);
  return reduced ? total : elapsed;
}

function CiStep({
  on,
  label,
  text,
}: {
  on: boolean;
  label: string;
  text: string;
}) {
  return (
    <div
      className={`flex h-14 flex-col justify-center rounded-md border border-dashed border-field-border/60 bg-surface px-3 transition-opacity duration-250 ${on ? "opacity-100" : "opacity-0"}`}
    >
      <span className="mono truncate text-xs">{label}</span>
      <span className="mt-0.5 truncate text-xs text-muted">{text}</span>
    </div>
  );
}

function Lane({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[176px_minmax(0,1fr)] gap-x-8 gap-y-4 max-lg:grid-cols-1">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1 text-xs text-muted">{text}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] gap-x-3 gap-y-6 max-md:grid-cols-1">
        {children}
      </div>
    </div>
  );
}

function Run({ active }: { active: boolean }) {
  const elapsed = useElapsed(active, RUN_MS);
  const on = elapsed > 0;
  const seconds = Math.min(
    Math.max((elapsed - TESTS_MS) / 1000, 0),
    MEDIAN_UPLOAD,
  );
  const done = TESTS_MS + UPLOAD_MS;
  const reveal = (delay: number) => ({
    style: { transitionDelay: on ? `${delay}ms` : "0ms" },
    className: `transition-[opacity,translate] duration-250 ease-out-strong ${on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`,
  });

  return (
    <div className="mt-8 grid gap-12">
      <Lane
        title="stateofpixel"
        text="One CLI step after your tests. Your runner does the work."
      >
        <CiStep
          on={on}
          label="npx playwright test"
          text="Takes the screenshots"
        />
        <div className="min-w-0">
          <div className="relative h-14">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${(MEDIAN_UPLOAD / AXIS) * 100}%` }}
            >
              <div
                style={{
                  transitionDuration: `${UPLOAD_MS}ms`,
                  transitionDelay: `${TESTS_MS}ms`,
                }}
                className={`flex h-full items-center overflow-hidden rounded-md bg-accent px-3 text-accent-fg transition-[clip-path] ease-linear motion-reduce:transition-none ${on ? "[clip-path:inset(0_0_0_0)]" : "[clip-path:inset(0_100%_0_0)]"}`}
              >
                <span className="mono truncate text-xs">
                  npx stateofpixel upload
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-3 h-5 border-t border-border">
            {TICKS.map((tick, index) => (
              <span
                key={tick}
                style={{ left: `${(tick / AXIS) * 100}%` }}
                className={`absolute top-0 flex flex-col text-2xs whitespace-nowrap text-subtle tabular-nums ${index === 0 ? "items-start" : index === TICKS.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"}`}
              >
                <span className="h-1.5 w-px bg-border" />
                {tick} s
              </span>
            ))}
          </div>
        </div>
        <div className="col-span-full flex flex-col gap-3">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[40px] leading-none font-semibold tracking-[-0.045em] tabular-nums">
              {seconds.toFixed(1)} s
            </span>
            <span className="text-xs text-muted">
              median upload on our own CI, from hashing to the check
            </span>
          </p>
          <ol className="mt-3 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {UPLOAD_STEPS.map(({ icon: Icon, title, text }, index) => {
              const item = reveal(done + index * 60);
              return (
                <li
                  key={title}
                  style={item.style}
                  className={`rounded-md bg-surface p-3 ring-1 ring-border ${item.className}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon size={16} className="shrink-0 text-muted" />
                    {title}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{text}</span>
                </li>
              );
            })}
          </ol>
          <div
            style={reveal(done + 300).style}
            className={`flex items-center gap-3 rounded-md bg-surface px-4 py-3 text-sm ring-1 ring-border ${reveal(done + 300).className}`}
          >
            <CircleIcon
              size={18}
              weight="bold"
              className={`shrink-0 ${TONE_TEXT.pending}`}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">stateofpixel</span>
              <span className="text-muted"> {CHECK.description}</span>
            </span>
            <span className="text-xs text-muted max-sm:hidden">Pending</span>
          </div>
        </div>
      </Lane>
      <Lane
        title="Hosted rendering"
        text="Tools that take your build and render it in their own browsers."
      >
        <CiStep on={on} label="Your CI step" text="Sends the build" />
        <div className="min-w-0">
          <ol className="grid grid-cols-5 gap-2 max-sm:grid-cols-1">
            {HOSTED_STEPS.map((step, index) => (
              <li
                key={step}
                style={{ transitionDelay: on ? `${index * 80}ms` : "0ms" }}
                className={`flex h-14 items-center rounded-md border border-dashed border-field-border/60 px-3 text-sm leading-tight text-muted transition-opacity duration-250 max-sm:h-10 ${on ? "opacity-100" : "opacity-0"}`}
              >
                {step}
              </li>
            ))}
          </ol>
        </div>
      </Lane>
    </div>
  );
}

export function SpeedSection() {
  const [ref, seen] = useInView();
  const [run, setRun] = useState(0);
  return (
    <section className={SECTION}>
      <LeadCopy title="Nothing to wait for." className="max-w-[720px]">
        The upload is one step in your CI, right after your tests. It hashes,
        sends what is new, compares and reports the check.
      </LeadCopy>
      <div ref={ref} className="mt-12 rounded-xl bg-surface-2 p-8 max-sm:p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">One pull request, one CI run</p>
          <button
            type="button"
            className={buttonClass("ghost", "sm")}
            onClick={() => setRun((current) => current + 1)}
            data-umami-event="Timeline replay"
            disabled={!seen}
          >
            <ArrowCounterClockwiseIcon size={12} />
            Replay
          </button>
        </div>
        <Run key={run} active={seen} />
      </div>
    </section>
  );
}
