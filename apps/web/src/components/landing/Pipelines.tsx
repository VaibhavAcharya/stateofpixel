import {
  ArrowRightIcon,
  CheckCircleIcon,
  CircleIcon,
  CloudSlashIcon,
  DatabaseIcon,
  FolderSimpleIcon,
  GitCommitIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  ImagesIcon,
  SquaresFourIcon,
  StackIcon,
  SwapIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { type StatusBuild, toStatus } from "@stateofpixel/backend/checkStatus";
import type { Id } from "@stateofpixel/backend/dataModel";
import { STORAGE_WARNING_SHARE } from "@stateofpixel/backend/limits";
import { Link } from "@tanstack/react-router";
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import merge from "../../snippets/pipelines-merge.yml?highlight";
import rebase from "../../snippets/pipelines-rebase.sh?highlight";
import shard from "../../snippets/pipelines-shard.yml?highlight";
import strict from "../../snippets/pipelines-strict.sh?highlight";
import subset from "../../snippets/pipelines-subset.sh?highlight";
import suites from "../../snippets/pipelines-suites.yml?highlight";
import threshold from "../../snippets/pipelines-threshold.sh?highlight";
import upload from "../../snippets/pipelines-upload.sh?highlight";
import { CodeBlock, type Snippet } from "../CodeBlock";
import { facts } from "../docs/facts";
import {
  DIFF_ICONS,
  type DiffStatus,
  DiffStatusPill,
  type Icon,
  LeadCopy,
  REVIEW_ICONS,
  type ReviewState,
  SnapshotName,
  TONE_TEXT,
} from "../ui";
import { PIPELINES, SECTION } from "./sections";

const COUNTS = {
  unchanged: 0,
  changed: 0,
  added: 0,
  removed: 0,
  failed: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

const TO_REVIEW: StatusBuild = {
  status: "finalized",
  conclusion: "changes",
  counts: { ...COUNTS, changed: 3, pending: 3 },
  shardsTotal: 1,
  doneShardIndexes: [1],
  storageBlocked: false,
  baselineBuildId: "baseline" as Id<"builds">,
  autoApproved: false,
};

const NO_CHANGES: StatusBuild = {
  ...TO_REVIEW,
  conclusion: "no_changes",
  counts: COUNTS,
};

const CLI_OUTPUT = `stateofpixel  build #411  feat/header vs main (#405)
  1,500 snapshots  1,488 unchanged  10 changed  2 added  1 removed
  uploaded 22 images (1.3 MB) in 2.1 s
  review: https://stateofpixel.com/acme/web-app/builds/411`;

type Group = "ci" | "branch" | "limits";

const GROUPS: Record<Group, string> = {
  ci: "While CI runs",
  branch: "When the branch changes",
  limits: "Limits and outages",
};

type Case = {
  label: string;
  code?: { file: string; code: string; lines?: Snippet["lines"] };
  where: string;
  outcome: ReactNode;
};

type Scenario = {
  title: string;
  group: Group;
  icon: Icon;
  flag?: string;
  answer: string;
  docs: { slug: string; hash?: string; label: string };
  cases: Case[];
};

function pipelineText(title: string) {
  return PIPELINES.find(([candidate]) => candidate === title)?.[1] ?? "";
}

function Checks({ rows }: { rows: [string, StatusBuild][] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map(([name, build]) => {
        const { state, description } = toStatus(build);
        const tone =
          state === "success"
            ? "approved"
            : state === "pending"
              ? "pending"
              : "rejected";
        const StateIcon =
          tone === "approved"
            ? CheckCircleIcon
            : tone === "pending"
              ? CircleIcon
              : XCircleIcon;
        return (
          <li key={name} className="flex items-start gap-3 px-4 py-3 text-sm">
            <StateIcon
              size={18}
              weight={tone === "pending" ? "bold" : "fill"}
              className={`shrink-0 ${TONE_TEXT[tone]}`}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{name}</span>{" "}
              <span className="text-muted">{description}</span>
            </span>
            <span className="text-xs text-link">Details</span>
          </li>
        );
      })}
    </ul>
  );
}

function Snapshots({
  rows,
}: {
  rows: {
    name: string;
    diff: DiffStatus;
    review: ReviewState;
    note: string;
  }[];
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const ReviewIcon =
          row.review === "none"
            ? DIFF_ICONS[row.diff]
            : REVIEW_ICONS[row.review];
        return (
          <li key={row.name} className="flex flex-col gap-1 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <ReviewIcon
                size={16}
                weight="bold"
                className={`shrink-0 ${TONE_TEXT[row.review === "none" ? row.diff : row.review]}`}
              />
              <SnapshotName name={row.name} className="flex-1" />
              <DiffStatusPill status={row.diff} />
            </span>
            <span className="pl-6 text-xs text-muted">{row.note}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="p-3">
      <p
        className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${tone}`}
      >
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span>{children}</span>
      </p>
    </div>
  );
}

function CiStep({ passed, children }: { passed: boolean; children: string }) {
  const StepIcon = passed ? CheckCircleIcon : XCircleIcon;
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span className="flex items-center gap-3 text-sm">
        <StepIcon
          size={18}
          weight="fill"
          className={passed ? "text-approved" : "text-rejected"}
        />
        <span className="mono min-w-0 flex-1 truncate">
          npx stateofpixel upload
        </span>
        <span className="mono text-xs text-muted tabular-nums">
          exit {passed ? 0 : 1}
        </span>
      </span>
      <span className="pl-[30px] text-xs text-muted">{children}</span>
    </div>
  );
}

function StorageMeter({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Storage</span>
        <span className="text-xs text-muted tabular-nums">
          {facts.storageWarning} of {facts.freeStorage}
        </span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full bg-changed"
          style={{ width: `${STORAGE_WARNING_SHARE * 100}%` }}
        />
      </span>
      <span className="flex items-start gap-2 text-xs text-muted">
        <WarningIcon size={14} className="mt-px shrink-0 text-pending" />
        {children}
      </span>
    </div>
  );
}

const SCENARIOS: Scenario[] = [
  {
    title: "Sharded suites",
    group: "ci",
    icon: SquaresFourIcon,
    flag: "--shard",
    answer:
      "Each shard uploads its part. The check reports once, after the last.",
    docs: { slug: "sharding", label: "Sharding" },
    cases: [
      {
        label: "2 of 4 shards done",
        code: { file: ".github/workflows/visual.yml", ...shard },
        where: "GitHub check",
        outcome: (
          <Checks
            rows={[
              [
                "stateofpixel",
                {
                  ...TO_REVIEW,
                  status: "pending",
                  shardsTotal: 4,
                  doneShardIndexes: [1, 2],
                },
              ],
            ]}
          />
        ),
      },
      {
        label: "All 4 done",
        code: { file: ".github/workflows/visual.yml", ...shard },
        where: "GitHub check",
        outcome: <Checks rows={[["stateofpixel", TO_REVIEW]]} />,
      },
    ],
  },
  {
    title: "Several suites",
    group: "ci",
    icon: StackIcon,
    flag: "--build-name",
    answer: "Each suite gets its own baselines and its own check.",
    docs: { slug: "suites", label: "Suites" },
    cases: [
      {
        label: "Two suites",
        code: { file: ".github/workflows/visual.yml", ...suites },
        where: "GitHub checks",
        outcome: (
          <Checks
            rows={[
              ["stateofpixel/e2e", NO_CHANGES],
              ["stateofpixel/storybook", TO_REVIEW],
            ]}
          />
        ),
      },
    ],
  },
  {
    title: "Partial runs",
    group: "ci",
    icon: FolderSimpleIcon,
    flag: "--subset",
    answer: "Snapshots that did not run are not reported as removed.",
    docs: {
      slug: "any-screenshots",
      hash: "partial-runs",
      label: "Any screenshots",
    },
    cases: [
      {
        label: "Without --subset",
        code: { file: "ci.sh", ...upload },
        where: "Build page",
        outcome: (
          <Snapshots
            rows={[
              {
                name: "Checkout/Form [1280]",
                diff: "removed",
                review: "none",
                note: "Did not run, so it shows as removed",
              },
              {
                name: "Checkout/Success [1280]",
                diff: "removed",
                review: "none",
                note: "Did not run, so it shows as removed",
              },
            ]}
          />
        ),
      },
      {
        label: "With --subset",
        code: { file: "ci.sh", ...subset },
        where: "GitHub check",
        outcome: <Checks rows={[["stateofpixel", NO_CHANGES]]} />,
      },
    ],
  },
  {
    title: "New pushes and rebases",
    group: "branch",
    icon: GitCommitIcon,
    answer:
      "Approvals carry over to the next push. Rejected images come back as pending.",
    docs: { slug: "review", hash: "new-pushes", label: "Reviewing changes" },
    cases: [
      {
        label: "Rebase",
        code: { file: "terminal", ...rebase },
        where: "Build page",
        outcome: (
          <Snapshots
            rows={[
              {
                name: "Pricing/Plans [1280]",
                diff: "changed",
                review: "approved",
                note: "Approved in build #409 by @octocat (carried over)",
              },
              {
                name: "Header/Default [1280]",
                diff: "changed",
                review: "pending",
                note: "Waiting for review, rejected in build #409",
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    title: "Squash and rebase merges",
    group: "branch",
    icon: GitMergeIcon,
    answer:
      "The build on main finds its pull request and marks changes never approved there.",
    docs: { slug: "baselines", hash: "after-a-merge", label: "Baselines" },
    cases: [
      {
        label: "Squash merge",
        code: { file: ".github/workflows/visual.yml", ...merge },
        where: "Build page on main",
        outcome: (
          <>
            <Banner
              tone="bg-unchanged-bg"
              icon={<GitPullRequestIcon size={16} className="text-unchanged" />}
            >
              From PR <span className="font-medium text-link">#412</span>. Its
              last build is <span className="font-medium text-link">#418</span>.
            </Banner>
            <Snapshots
              rows={[
                {
                  name: "Footer/Default [1280]",
                  diff: "changed",
                  review: "approved",
                  note: "Approved automatically, not reviewed on PR",
                },
              ]}
            />
          </>
        ),
      },
    ],
  },
  {
    title: "Flaky screenshots",
    group: "branch",
    icon: SwapIcon,
    flag: "--threshold",
    answer: "A snapshot that flips back and forth is marked as looking flaky.",
    docs: {
      slug: "stable-screenshots",
      hash: "find-flaky-snapshots",
      label: "Stable screenshots",
    },
    cases: [
      {
        label: "Flips on main",
        code: { file: "terminal", ...threshold },
        where: "Build page",
        outcome: (
          <Snapshots
            rows={[
              {
                name: "Invoices/Empty [1280]",
                diff: "changed",
                review: "pending",
                note: "Looks flaky: flipped 3 times in 10 builds.",
              },
            ]}
          />
        ),
      },
      {
        label: "Differs on a re-run",
        code: { file: "terminal", ...threshold },
        where: "Build page",
        outcome: (
          <Snapshots
            rows={[
              {
                name: "Invoices/Empty [1280]",
                diff: "changed",
                review: "pending",
                note: "Looks flaky: build #410 of the same commit has a different image.",
              },
            ]}
          />
        ),
      },
    ],
  },
  {
    title: "Large suites",
    group: "limits",
    icon: ImagesIcon,
    answer: `Up to ${facts.snapshotsPerBuild} snapshots a build. Unchanged images are not uploaded again.`,
    docs: { slug: "limits", hash: "limits", label: "Limits and storage" },
    cases: [
      {
        label: "Upload",
        code: { file: "terminal", code: CLI_OUTPUT },
        where: "GitHub check",
        outcome: (
          <Checks
            rows={[
              [
                "stateofpixel",
                {
                  ...TO_REVIEW,
                  counts: {
                    ...COUNTS,
                    unchanged: 1488,
                    changed: 10,
                    added: 2,
                    removed: 1,
                    pending: 12,
                  },
                },
              ],
            ]}
          />
        ),
      },
    ],
  },
  {
    title: "Our outages",
    group: "limits",
    icon: CloudSlashIcon,
    flag: "--strict",
    answer: "If stateofpixel is down, the upload warns and exits 0.",
    docs: { slug: "cli", hash: "exit-codes", label: "CLI" },
    cases: [
      {
        label: "Default",
        code: { file: "ci.sh", ...upload },
        where: "CI log",
        outcome: <CiStep passed>skipped, the service is not reachable</CiStep>,
      },
      {
        label: "With --strict",
        code: { file: "ci.sh", ...strict },
        where: "CI log",
        outcome: (
          <CiStep passed={false}>
            The CLI exits 1 instead, so the job fails
          </CiStep>
        ),
      },
    ],
  },
  {
    title: "Running out of storage",
    group: "limits",
    icon: DatabaseIcon,
    answer: `Warns at ${facts.storageWarning}. After ${facts.graceDays} days over, the check passes with a note.`,
    docs: {
      slug: "limits",
      hash: "when-an-account-is-over-its-limit",
      label: "Limits and storage",
    },
    cases: [
      {
        label: `At ${facts.storageWarning}`,
        where: "Account page",
        outcome: (
          <StorageMeter>
            The account pages and the CLI warn. Everything keeps working.
          </StorageMeter>
        ),
      },
      {
        label: `${facts.graceDays} days over`,
        where: "GitHub check",
        outcome: (
          <Checks
            rows={[["stateofpixel", { ...TO_REVIEW, storageBlocked: true }]]}
          />
        ),
      },
    ],
  },
];

const HEADING = "How it handles sharding, merges and outages.";

function DocsLink({ docs }: { docs: Scenario["docs"] }) {
  return (
    <Link
      to="/docs/$slug"
      params={{ slug: docs.slug }}
      hash={docs.hash}
      className="group/docs inline-flex items-center gap-1.5 text-sm text-link"
    >
      {docs.label} docs
      <ArrowRightIcon
        size={14}
        className="transition-transform duration-180 ease-out-strong group-hover/docs:translate-x-0.5"
      />
    </Link>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-md bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]">
      <figcaption className="flex h-10 shrink-0 items-center border-b border-border px-4 text-xs text-muted">
        {label}
      </figcaption>
      <div className="flex-1">{children}</div>
    </figure>
  );
}

function CaseSwitch({
  cases,
  value,
  onChange,
}: {
  cases: Case[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <fieldset
      aria-label="Case"
      className="flex w-fit max-w-full flex-wrap gap-1 rounded-control bg-surface-2 p-0.5"
    >
      {cases.map((option, index) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === index}
          onClick={() => onChange(index)}
          className={`h-7 rounded-sm px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-100 pointer-coarse:h-9 ${
            value === index
              ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
              : "text-muted hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function WithFlags({ text }: { text: string }) {
  return text.split(/(--[a-z]+(?: \d\/\d| auto)?)/).map((part, index) =>
    index % 2 === 1 ? (
      <code
        key={part}
        className="mono rounded-xs bg-surface-2 px-1 whitespace-nowrap text-text"
      >
        {part}
      </code>
    ) : (
      part
    ),
  );
}

function ScenarioDetail({ scenario }: { scenario: Scenario }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const current = scenario.cases[caseIndex] ?? scenario.cases[0];
  if (current === undefined) {
    return null;
  }
  return (
    <div className="flex animate-fade flex-col gap-5">
      <div>
        <p className="text-xs text-muted">{GROUPS[scenario.group]}</p>
        <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
          {scenario.title}
        </h3>
        <p className="mt-2 max-w-[64ch] text-sm text-muted">
          <WithFlags text={pipelineText(scenario.title)} />
        </p>
      </div>
      {scenario.cases.length > 1 && (
        <CaseSwitch
          cases={scenario.cases}
          value={caseIndex}
          onChange={setCaseIndex}
        />
      )}
      <div className="flex flex-col gap-3">
        {current.code !== undefined && (
          <CodeBlock fileName={current.code.file} {...current.code} />
        )}
        <Frame label={current.where}>{current.outcome}</Frame>
      </div>
      <DocsLink docs={scenario.docs} />
    </div>
  );
}

export function PipelinesSection() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const scenario = SCENARIOS[selected] ?? SCENARIOS[0];

  useEffect(() => {
    const tab = tabs.current[selected];
    if (tab) {
      setBar({ top: tab.offsetTop, height: tab.offsetHeight });
    }
  }, [selected]);

  function select(index: number) {
    const next = (index + SCENARIOS.length) % SCENARIOS.length;
    setSelected(next);
    const tab = tabs.current[next];
    tab?.focus();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent) {
    const keys: Record<string, number> = {
      ArrowDown: selected + 1,
      ArrowRight: selected + 1,
      ArrowUp: selected - 1,
      ArrowLeft: selected - 1,
      Home: 0,
      End: SCENARIOS.length - 1,
    };
    const next = keys[event.key];
    if (next !== undefined) {
      event.preventDefault();
      select(next);
    }
  }

  return (
    <section className={SECTION}>
      <LeadCopy title={HEADING} className="max-w-[720px]">
        Pick a case to see the CI step and what the check shows.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-[280px_minmax(0,1fr)] gap-12 max-lg:grid-cols-1 max-lg:gap-6">
        <div
          role="tablist"
          aria-label="Cases"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          className="relative flex flex-col max-lg:-mx-6 max-lg:flex-row max-lg:gap-1 max-lg:overflow-x-auto max-lg:px-6 max-lg:pb-1 max-sm:-mx-4 max-sm:px-4"
        >
          <span
            aria-hidden
            className={`absolute top-0 left-0 w-0.5 rounded-full bg-link transition-transform duration-180 ease-out-strong max-lg:hidden ${bar === null ? "opacity-0" : ""}`}
            style={{
              height: bar?.height,
              transform: `translateY(${bar?.top ?? 0}px)`,
            }}
          />
          {SCENARIOS.map((item, index) => {
            const ItemIcon = item.icon;
            const active = index === selected;
            const groupStart = SCENARIOS[index - 1]?.group !== item.group;
            return (
              <Fragment key={item.title}>
                {groupStart && (
                  <span
                    aria-hidden
                    className={`px-3 pb-2 text-xs text-muted max-lg:hidden ${index === 0 ? "" : "pt-5"}`}
                  >
                    {GROUPS[item.group]}
                  </span>
                )}
                <button
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`pipelines-tab-${index}`}
                  aria-selected={active}
                  aria-controls="pipelines-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => select(index)}
                  className={`flex h-9 shrink-0 items-center gap-2.5 rounded-sm px-3 text-left text-sm whitespace-nowrap transition-colors duration-100 pointer-coarse:h-11 lg:rounded-l-none ${
                    active
                      ? "bg-hover font-medium text-text"
                      : "text-muted hover:bg-hover hover:text-text"
                  }`}
                >
                  <ItemIcon size={16} className="shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  {item.flag !== undefined && (
                    <span className="mono text-xs text-subtle max-lg:hidden">
                      {item.flag}
                    </span>
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
        {scenario !== undefined && (
          <div
            role="tabpanel"
            id="pipelines-panel"
            aria-labelledby={`pipelines-tab-${selected}`}
            className="min-w-0"
          >
            <ScenarioDetail key={scenario.title} scenario={scenario} />
          </div>
        )}
      </div>
    </section>
  );
}
