import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CircleIcon,
  PlayIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { toStatus } from "@stateofpixel/backend/checkStatus";
import { useEffect, useRef, useState } from "react";
import { Button } from "uiofcraft";
import { track } from "../../lib/analytics";
import { BuildPage, ShortcutsContext } from "../build/BuildPage";
import { BuildDataContext } from "../build/buildData";
import {
  type BuildFixture,
  changed,
  unchanged,
  useFixtureBuild,
} from "../build/fixtureBuild";
import type { Build } from "../build/types";
import { ShortcutsDialog } from "../ShortcutsDialog";
import { TONE_TEXT } from "../ui";

const DEMO_FIXTURE: BuildFixture = {
  build: {
    number: 412,
    buildName: "default",
    branch: "pricing-cards",
    baselineBranch: "main",
    commitSha: "8c41e0d2b7a95f63e1d4c0b9a8f7e6d5c4b3a291",
    commitMessage: "Tighten pricing cards",
    prNumber: 131,
    prState: "open",
    status: "finalized",
    superseded: false,
    shards: { done: 1, total: 1 },
    autoApproved: false,
    storageBlocked: false,
    ciRunUrl: null,
    baseline: { number: 409, branch: "main" },
    supersededBy: null,
    mergedPr: null,
  },
  snapshots: [
    changed("buttons", "Button/All [600]", 1829),
    changed("header", "Header/Default [600]", 540),
    changed("pricing", "Pricing/Plans [600]", 78),
    changed("signin", "Sign in/Error [600]", 3393),
    {
      id: "invoices",
      name: "Invoices/Empty [600]",
      diffStatus: "added",
      reviewState: "pending",
      image: "/demo/invoices-new.png",
      baselineImage: null,
      diffImage: null,
    },
    unchanged("footer", "Footer/Default [600]", "/demo/header-base.png"),
    unchanged("nav", "Navigation/Mobile [600]", "/demo/buttons-base.png"),
    unchanged("pricing-free", "Pricing/Free [600]", "/demo/pricing-base.png"),
  ],
  reviewer: "you",
};

function firstSnapshotId() {
  return window.matchMedia("(max-width: 639px)").matches ? "header" : "signin";
}

function demoTrack(event: string, data?: Parameters<typeof track>[1]) {
  track(`Demo ${event.toLowerCase()}`, data);
}

export function ReviewDemo() {
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  return (
    <DemoRun
      key={run}
      started={started}
      onStart={() => {
        setStarted(true);
        demoTrack("Start");
      }}
      onReset={() => setRun((value) => value + 1)}
    />
  );
}

function DemoRun({
  started,
  onStart,
  onReset,
}: {
  started: boolean;
  onStart: () => void;
  onReset: () => void;
}) {
  const { build, data } = useFixtureBuild(DEMO_FIXTURE);
  const [snapshotId, setSnapshotId] = useState("signin");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => setSnapshotId(firstSnapshotId()), []);

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

  return (
    <div ref={root} className="flex flex-col gap-3">
      <BuildDataContext.Provider
        value={{
          ...data,
          useSelection: () => ({ snapshotId, select: setSnapshotId }),
        }}
      >
        <ShortcutsContext.Provider
          value={{ open: shortcutsOpen, setOpen: setShortcutsOpen }}
        >
          <section
            aria-label="Interactive review demo"
            className="relative flex h-[720px] flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs/5"
          >
            <div inert={!started} className="flex min-h-0 flex-1 flex-col">
              <BuildPage
                build={build}
                canWrite
                owner="acme"
                repo="web"
                links={false}
                headings={false}
                keyboard={started && active}
                track={demoTrack}
              />
            </div>
            {!started && <StartOverlay onStart={onStart} />}
          </section>
        </ShortcutsContext.Provider>
      </BuildDataContext.Provider>
      {shortcutsOpen && (
        <ShortcutsDialog open onClose={() => setShortcutsOpen(false)} />
      )}
      <CheckRun build={build} onReset={onReset} />
    </div>
  );
}

function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 p-4 backdrop-blur-[1.5px]">
      <button
        type="button"
        onClick={onStart}
        className="group flex flex-col items-center gap-4 rounded-2xl border bg-popover px-8 py-6 text-center shadow-lg/5 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
          <PlayIcon size={22} weight="fill" className="translate-x-px" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-heading font-semibold text-lg">
            Try the review page
          </span>
          <span className="max-w-64 text-muted-foreground text-sm">
            Five changes are waiting. Approve or reject them, with the mouse or
            j, k, a and r.
          </span>
        </span>
      </button>
    </div>
  );
}

function CheckRun({ build, onReset }: { build: Build; onReset: () => void }) {
  const { state, description } = toStatus({
    status: build.status,
    conclusion: build.conclusion,
    counts: build.counts,
    shardsTotal: build.shards.total,
    doneShardIndexes: [],
    storageBlocked: build.storageBlocked,
    baselineBuildId: build.baseline === null ? null : build.buildId,
    autoApproved: build.autoApproved,
  });
  const tone =
    state === "success"
      ? "approved"
      : state === "failure"
        ? "rejected"
        : "pending";
  const Icon =
    tone === "approved"
      ? CheckCircleIcon
      : tone === "rejected"
        ? XCircleIcon
        : CircleIcon;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm border shadow-xs/5">
      <Icon
        size={18}
        weight={tone === "pending" ? "bold" : "fill"}
        className={TONE_TEXT[tone]}
      />
      <span className="min-w-0 flex-1">
        <span className="font-medium">stateofpixel/playwright</span>
        <span className="text-muted-foreground"> {description}</span>
      </span>
      {build.counts.pending === 0 && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <ArrowCounterClockwiseIcon size={12} />
          Start over
        </Button>
      )}
      <span className="text-xs text-muted-foreground max-sm:hidden">
        {state === "success"
          ? "Success"
          : state === "failure"
            ? "Failure"
            : "Pending"}
      </span>
    </div>
  );
}
