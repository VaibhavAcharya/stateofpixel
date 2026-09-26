import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
  CheckCircleIcon,
  CircleIcon,
  GitBranchIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { useEffect, useRef, useState } from "react";
import { ZOOM_STEP } from "../../lib/canvasView";
import { formatPercent } from "../../lib/format";
import {
  buttonClass,
  DIFF_ICONS,
  type DiffStatus,
  Kbd,
  Pill,
  REVIEW_ICONS,
  type ReviewState,
  SnapshotName,
  TONE_TEXT,
} from "../ui";
import {
  MODES,
  useViewerSettings,
  Viewer,
  type ViewerSnapshot,
} from "../Viewer";

type DemoSnapshot = ViewerSnapshot & { id: string };

const SIZE = { width: 600, height: 375 };
const AREA = SIZE.width * SIZE.height;

function images(slug: string, status: DiffStatus) {
  const image = (suffix: string) => ({
    url: `/demo/${slug}-${suffix}.png`,
    ...SIZE,
  });
  return {
    image: image("new"),
    baselineImage: status === "added" ? null : image("base"),
    diffImage: status === "added" ? null : image("diff"),
  };
}

const DEMO_SNAPSHOTS: DemoSnapshot[] = [
  {
    id: "pricing",
    name: "Pricing/Plans [600]",
    diffStatus: "changed",
    diffRatio: 78 / AREA,
    diffPixels: 78,
    ...images("pricing", "changed"),
  },
  {
    id: "buttons",
    name: "Button/All [600]",
    diffStatus: "changed",
    diffRatio: 1829 / AREA,
    diffPixels: 1829,
    ...images("buttons", "changed"),
  },
  {
    id: "signin",
    name: "Sign in/Error [600]",
    diffStatus: "changed",
    diffRatio: 3393 / AREA,
    diffPixels: 3393,
    ...images("signin", "changed"),
  },
  {
    id: "header",
    name: "Header/Default [600]",
    diffStatus: "changed",
    diffRatio: 540 / AREA,
    diffPixels: 540,
    ...images("header", "changed"),
  },
  {
    id: "invoices",
    name: "Invoices/Empty [600]",
    diffStatus: "added",
    diffRatio: null,
    diffPixels: null,
    ...images("invoices", "added"),
  },
];

const UNCHANGED_COUNT = 214;

const FIRST_INDEX = DEMO_SNAPSHOTS.findIndex(({ id }) => id === "signin");

function snapshotAt(index: number) {
  const snapshot = DEMO_SNAPSHOTS[index];
  if (snapshot === undefined) {
    throw new Error(`No demo snapshot at ${index}`);
  }
  return snapshot;
}

type Review = Exclude<ReviewState, "none">;

function useDemoReview() {
  const [reviews, setReviews] = useState<Record<string, Review>>(() =>
    Object.fromEntries(DEMO_SNAPSHOTS.map(({ id }) => [id, "pending"])),
  );
  const [index, setIndex] = useState(FIRST_INDEX);
  const current = snapshotAt(index);
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const state of Object.values(reviews)) {
    counts[state] += 1;
  }

  const move = (step: number) =>
    setIndex(
      (value) => (value + step + DEMO_SNAPSHOTS.length) % DEMO_SNAPSHOTS.length,
    );

  const advance = (next: Record<string, Review>) => {
    const after = [
      ...DEMO_SNAPSHOTS.slice(index + 1),
      ...DEMO_SNAPSHOTS.slice(0, index),
    ].find(({ id }) => next[id] === "pending");
    if (after) {
      setIndex(DEMO_SNAPSHOTS.indexOf(after));
    }
  };

  const review = (state: Review, advanceAfter = true) => {
    const next = { ...reviews, [current.id]: state };
    setReviews(next);
    if (advanceAfter && state !== "pending") {
      advance(next);
    }
  };

  const approveAll = () =>
    setReviews((value) =>
      Object.fromEntries(
        Object.entries(value).map(([id, state]) => [
          id,
          state === "pending" ? "approved" : state,
        ]),
      ),
    );

  const reset = () => {
    setReviews(
      Object.fromEntries(DEMO_SNAPSHOTS.map(({ id }) => [id, "pending"])),
    );
    setIndex(FIRST_INDEX);
  };

  return {
    reviews,
    index,
    setIndex,
    current,
    counts,
    move,
    review,
    approveAll,
    reset,
  };
}

type DemoReview = ReturnType<typeof useDemoReview>;

function plural(count: number, noun: string, suffix: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"} ${suffix}`;
}

function checkSummary(counts: DemoReview["counts"]) {
  if (counts.rejected > 0) {
    return {
      tone: "rejected" as const,
      title: plural(counts.rejected, "change", "rejected"),
    };
  }
  if (counts.pending > 0) {
    return {
      tone: "pending" as const,
      title: plural(counts.pending, "change", "to review"),
    };
  }
  return {
    tone: "approved" as const,
    title: plural(counts.approved, "change", "approved"),
  };
}

export function ReviewDemo() {
  const state = useDemoReview();
  const settings = useViewerSettings();
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState({ unchanged: false });
  const { reviews, index, setIndex, current, counts, move, review } = state;

  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setActive((entry?.intersectionRatio ?? 0) >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      const mode = MODES.find((item) => item.key === event.key);
      if (mode !== undefined) {
        settings.setMode(mode.value);
        return;
      }
      switch (event.key) {
        case "j":
          move(1);
          break;
        case "k":
          move(-1);
          break;
        case "a":
          review("approved");
          break;
        case "A":
          state.approveAll();
          break;
        case "r":
          review("rejected");
          break;
        case "u":
          review("pending", false);
          break;
        case "d":
          if (settings.mode === "side") {
            settings.setSideDiff(!settings.sideDiff);
          }
          break;
        case " ":
          if (settings.mode === "flip") {
            event.preventDefault();
            settings.setShowBaseline(!settings.showBaseline);
          }
          break;
        case "f":
          settings.setView(null);
          break;
        case "0":
          settings.zoom({ to: 1 });
          break;
        case "=":
        case "+":
          settings.zoom({ by: ZOOM_STEP });
          break;
        case "-":
          settings.zoom({ by: 1 / ZOOM_STEP });
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, move, review, settings, state]);

  const reviewState = reviews[current.id] ?? "pending";
  const summary = checkSummary(counts);
  const changed = DEMO_SNAPSHOTS.filter(
    ({ diffStatus }) => diffStatus === "changed",
  );
  const added = DEMO_SNAPSHOTS.filter(
    ({ diffStatus }) => diffStatus === "added",
  );

  return (
    <div ref={root} className="flex flex-col gap-3">
      <section
        aria-label="Interactive review demo"
        className="flex h-[640px] flex-col overflow-hidden rounded-lg bg-surface text-left shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a] ring-1 ring-border max-md:h-[560px]"
      >
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
          <span className="text-lg font-semibold tracking-[-0.01em]">
            <span className="text-muted">#412</span> Tighten pricing cards
          </span>
          <span className="flex items-center gap-1 text-xs text-muted max-sm:hidden">
            <GitBranchIcon size={12} />
            <span className="mono">pricing-cards</span>
          </span>
          <Pill tone={summary.tone} icon={checkIcon(summary.tone)}>
            {summary.title}
          </Pill>
          <span className="ml-auto flex gap-2 max-sm:hidden">
            {counts.pending === 0 ? (
              <button
                type="button"
                className={buttonClass("ghost")}
                onClick={state.reset}
              >
                <ArrowCounterClockwiseIcon size={14} />
                Start over
              </button>
            ) : (
              <button
                type="button"
                className={buttonClass("primary")}
                data-umami-event="Demo approve all"
                onClick={state.approveAll}
              >
                Approve all
                <Kbd inverted>A</Kbd>
              </button>
            )}
          </span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="w-[248px] shrink-0 overflow-y-auto border-r border-border p-2 max-lg:hidden">
            {[
              { status: "changed" as const, label: "Changed", rows: changed },
              { status: "added" as const, label: "Added", rows: added },
            ].map((group) => {
              const GroupIcon = DIFF_ICONS[group.status];
              return (
                <div key={group.status} className="pt-2 first:pt-0">
                  <div className="flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-muted">
                    <GroupIcon
                      size={12}
                      weight="bold"
                      className={TONE_TEXT[group.status]}
                    />
                    {group.label}
                    <span className="ml-auto flex items-center gap-1.5 font-normal tabular-nums">
                      {group.rows.length}
                      <CaretDownIcon size={12} className="text-subtle" />
                    </span>
                  </div>
                  <ul>
                    {group.rows.map((row) => {
                      const rowState = reviews[row.id] ?? "pending";
                      const RowIcon =
                        rowState === "pending"
                          ? DIFF_ICONS[row.diffStatus]
                          : REVIEW_ICONS[rowState];
                      const selected = row.id === current.id;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            aria-current={selected ? "true" : undefined}
                            onClick={() =>
                              setIndex(DEMO_SNAPSHOTS.indexOf(row))
                            }
                            className={`relative flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors duration-100 hover:bg-hover ${
                              selected
                                ? "bg-hover before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-link"
                                : ""
                            }`}
                          >
                            <RowIcon
                              size={14}
                              weight={
                                rowState === "approved" ? "bold" : "regular"
                              }
                              className={`shrink-0 ${
                                rowState === "pending"
                                  ? TONE_TEXT[row.diffStatus]
                                  : TONE_TEXT[rowState]
                              }`}
                            />
                            <SnapshotName name={row.name} className="flex-1" />
                            {row.diffRatio !== null && (
                              <span className="shrink-0 text-xs text-muted tabular-nums">
                                {formatPercent(row.diffRatio)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div className="pt-2">
              <button
                type="button"
                aria-expanded={groupsOpen.unchanged}
                onClick={() =>
                  setGroupsOpen((value) => ({
                    unchanged: !value.unchanged,
                  }))
                }
                className="group flex h-7 w-full items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted hover:text-text"
              >
                <DIFF_ICONS.unchanged
                  size={12}
                  weight="bold"
                  className={TONE_TEXT.unchanged}
                />
                Unchanged
                <span className="ml-auto flex items-center gap-1.5 font-normal tabular-nums">
                  {UNCHANGED_COUNT}
                  <CaretRightIcon
                    size={12}
                    className="text-subtle group-hover:text-muted"
                  />
                </span>
              </button>
              {groupsOpen.unchanged && (
                <p className="px-2 py-1 text-xs text-muted">
                  Same hash as the baseline. Nothing was uploaded for these.
                </p>
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <Viewer
              snapshot={current}
              baselineLabel="Baseline #409 on main"
              newLabel="#412"
              settings={settings}
              navigation={
                <div className="flex items-center gap-1">
                  <span className="px-1 text-xs text-muted tabular-nums">
                    {index + 1} of {DEMO_SNAPSHOTS.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous snapshot"
                    title="Previous (k)"
                    className={buttonClass("ghost", "icon-sm")}
                    onClick={() => move(-1)}
                  >
                    <CaretUpIcon size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next snapshot"
                    title="Next (j)"
                    className={buttonClass("ghost", "icon-sm")}
                    onClick={() => move(1)}
                  >
                    <CaretDownIcon size={14} />
                  </button>
                </div>
              }
            />
            <div className="flex min-h-14 shrink-0 items-center gap-3 border-t border-border px-4 py-2.5">
              <ReviewLine state={reviewState} />
              <div className="ml-auto flex items-center gap-2">
                {reviewState !== "pending" ? (
                  <button
                    type="button"
                    className={buttonClass("ghost")}
                    onClick={() => review("pending", false)}
                  >
                    Undo
                    <Kbd>u</Kbd>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={buttonClass("danger")}
                      onClick={() => review("rejected")}
                    >
                      Reject
                      <Kbd>r</Kbd>
                    </button>
                    <button
                      type="button"
                      className={buttonClass("primary")}
                      onClick={() => review("approved")}
                    >
                      Approve
                      <Kbd inverted>a</Kbd>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      <CheckRun counts={counts} />
    </div>
  );
}

function checkIcon(tone: "pending" | "approved" | "rejected") {
  return tone === "approved"
    ? REVIEW_ICONS.approved
    : tone === "rejected"
      ? REVIEW_ICONS.rejected
      : REVIEW_ICONS.pending;
}

function ReviewLine({ state }: { state: Review }) {
  if (state === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted max-sm:hidden">
        <REVIEW_ICONS.pending size={14} className="text-pending" />
        Waiting for review
      </span>
    );
  }
  const Icon = REVIEW_ICONS[state];
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted max-sm:hidden">
      <Icon size={14} weight="bold" className={TONE_TEXT[state]} />
      {state === "approved"
        ? "Approved by you just now"
        : "Rejected by you just now"}
    </span>
  );
}

function CheckRun({ counts }: { counts: DemoReview["counts"] }) {
  const summary = checkSummary(counts);
  const Icon =
    summary.tone === "approved"
      ? CheckCircleIcon
      : summary.tone === "rejected"
        ? XCircleIcon
        : CircleIcon;
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface px-4 py-3 text-sm ring-1 ring-border">
      <Icon
        size={18}
        weight={summary.tone === "pending" ? "bold" : "fill"}
        className={TONE_TEXT[summary.tone]}
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium">stateofpixel/playwright</span>
        <span className="text-muted"> {summary.title}</span>
      </span>
      <span className="text-xs text-muted max-sm:hidden">
        {summary.tone === "approved"
          ? "Success"
          : summary.tone === "rejected"
            ? "Failure"
            : "Pending"}
      </span>
    </div>
  );
}
