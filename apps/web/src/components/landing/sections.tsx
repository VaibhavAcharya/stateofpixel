import {
  ArrowRightIcon,
  CheckIcon,
  GearSixIcon,
  ListIcon,
  LockSimpleIcon,
  TerminalWindowIcon,
  UserMinusIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { COMPETITORS } from "../../content/compare";
import { useAuth } from "../../lib/auth";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import checkoutTest from "../../snippets/checkout-test.ts?highlight";
import local from "../../snippets/local.sh?highlight";
import otherCi from "../../snippets/other-ci.sh?highlight";
import playwrightConfig from "../../snippets/playwright.config.ts?highlight";
import storybook from "../../snippets/storybook.yml?highlight";
import workflow from "../../snippets/workflow.yml?highlight";
import { CodeBlock, type Snippet } from "../CodeBlock";
import { facts } from "../docs/facts";
import { Menu, menuItemClass, useCloseMenu } from "../Menu";
import { AuthButton, SignInButton } from "../SignIn";
import { buttonClass, type Icon, Kbd, LeadCopy, Wordmark } from "../ui";
import { ReviewDemo } from "./ReviewDemo";

export const WIDE = "mx-auto max-w-[1448px] px-6 max-sm:px-4";
export const SECTION = `${WIDE} py-24 max-sm:py-12`;
export const LEAD =
  "text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl";

export const DISPLAY =
  "text-[clamp(40px,4.6vw,66px)] leading-[1.1] font-semibold tracking-[-0.045em] text-balance";

/* Header */

export const REPO_URL = "https://github.com/VaibhavAcharya/stateofpixel";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/packages/cli/CHANGELOG.md`;

const NAV = [
  ["Demo", "/#demo"],
  ["How it works", "/#how"],
  ["Pricing", "/#pricing"],
  ["FAQ", "/#faq"],
  ["Compare", "/compare"],
  ["Docs", "/docs"],
  ["Open source", REPO_URL],
] as const;

export function HeaderNav() {
  return (
    <header className="sticky top-0 z-10 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1448px] items-center gap-6 px-6 max-sm:px-4">
        <Link to="/" aria-label="stateofpixel home">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm max-md:hidden">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className={buttonClass("ghost")}>
              {label}
            </a>
          ))}
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}

function HeaderActions() {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <div className="ml-auto flex items-center gap-2">
      {!isLoading && !isAuthenticated && (
        <SignInButton
          label="Sign in"
          variant="ghost"
          className="max-sm:hidden"
        />
      )}
      <AuthButton label="Start free" />
      <div className="md:hidden">
        <Menu
          label="Menu"
          align="end"
          width="w-48"
          triggerClassName={buttonClass("ghost", "icon")}
          trigger={<ListIcon size={16} />}
        >
          {NAV.map(([label, href]) => (
            <MobileNavLink key={href} href={href}>
              {label}
            </MobileNavLink>
          ))}
        </Menu>
      </div>
    </div>
  );
}

function MobileNavLink({ href, children }: { href: string; children: string }) {
  const close = useCloseMenu();
  return (
    <a href={href} className={menuItemClass} onClick={close}>
      {children}
    </a>
  );
}

/* Hero */

export function HeroCentered() {
  return (
    <section className="pixel-texture pb-16">
      <div className={`${WIDE} pt-24 pb-16 text-center max-sm:pt-12`}>
        <h1 className="mx-auto max-w-[20ch] text-[clamp(36px,3.6vw,52px)] leading-[1.1] font-semibold tracking-[-0.045em] text-balance">
          Catch UI regressions{" "}
          <span className="text-muted">before they merge.</span>
        </h1>
        <p className={`${LEAD} mx-auto mt-6 max-w-[640px]`}>
          Every pull request gets a visual check. Your CI takes the screenshots,
          a person approves each change.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <AuthButton label="Start free with GitHub" />
          <a
            href="#pricing"
            className={buttonClass("secondary")}
            data-umami-event="Hero see pricing"
          >
            See pricing
            <ArrowRightIcon size={14} className="text-muted" />
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">
          Free up to {facts.freeStorage}. No card. Playwright, Storybook or any
          folder of PNGs.
        </p>
      </div>
      <DemoSection />
    </section>
  );
}

/* Product */

function Checker({ children }: { children: ReactNode }) {
  return (
    <div className="checker rounded-xl p-6 ring-1 ring-border max-md:p-3">
      {children}
    </div>
  );
}

export function DemoSection() {
  return (
    <section id="demo" className={`${WIDE} scroll-mt-20`}>
      <Checker>
        <ReviewDemo />
      </Checker>
      <DemoKeys />
    </section>
  );
}

function DemoKeys() {
  return (
    <p className="mx-auto mt-4 flex w-fit flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-lg bg-surface px-4 py-2 text-xs text-muted ring-1 ring-border max-lg:hidden">
      <span className="font-medium text-text">
        Same review page as the app. Try the keys:
      </span>
      <span>
        <Kbd>j</Kbd> <Kbd>k</Kbd> move
      </span>
      <span>
        <Kbd>a</Kbd> approve
      </span>
      <span>
        <Kbd>r</Kbd> reject
      </span>
      <span>
        <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> <Kbd>4</Kbd> views
      </span>
      <span>
        <Kbd>d</Kbd> diff overlay
      </span>
      <span>
        <Kbd>?</Kbd> all keys
      </span>
    </p>
  );
}

/* Setup */

function Logo({ name, size = 14 }: { name: string; size?: number }) {
  return <img src={`/logos/${name}.svg`} alt="" width={size} height={size} />;
}

type SetupTab = {
  label: string;
  icon: ReactNode;
  note: string;
  slug: string;
  blocks: { file: string; snippet: Snippet }[];
};

const SETUP_TABS = {
  playwright: {
    label: "Playwright",
    icon: <Logo name="playwright" />,
    note: "snapshot() waits for fonts, disables animations and hides the caret. The reporter uploads when the run ends, once per shard.",
    slug: "playwright",
    blocks: [
      { file: "playwright.config.ts", snippet: playwrightConfig },
      { file: "tests/checkout.spec.ts", snippet: checkoutTest },
    ],
  },
  storybook: {
    label: "Storybook",
    icon: <Logo name="storybook" />,
    note: "Captures every story at each width, named like Button/Primary [chromium 1280]. Needs Playwright in the project.",
    slug: "storybook",
    blocks: [{ file: ".github/workflows/visual.yml", snippet: storybook }],
  },
  actions: {
    label: "GitHub Actions",
    icon: <Logo name="github-actions" />,
    note: "Point the CLI at the folder your tests write screenshots to. The file path becomes the snapshot name.",
    slug: "any-screenshots",
    blocks: [{ file: ".github/workflows/visual.yml", snippet: workflow }],
  },
  other: {
    label: "Other CI",
    icon: <GearSixIcon size={14} className="text-muted" />,
    note: "Create a project token in the project settings and set it as STATEOFPIXEL_TOKEN.",
    slug: "other-ci",
    blocks: [{ file: "ci.sh", snippet: otherCi }],
  },
  local: {
    label: "Local",
    icon: <TerminalWindowIcon size={14} className="text-muted" />,
    note: "Compare two folders on your machine and open an HTML report. No account needed.",
    slug: "cli",
    blocks: [{ file: "terminal", snippet: local }],
  },
} satisfies Record<string, SetupTab>;

type SetupTabKey = keyof typeof SETUP_TABS;

export const HOW_STEPS: [string, string][] = [
  [
    "Install the GitHub App",
    "Pick the repositories. Each one becomes a project.",
  ],
  [
    "Add the reporter or one CI step",
    "Playwright, Storybook or any folder of PNGs.",
  ],
  [
    "Open a pull request",
    "The check links to the review page. Approve, and it turns green.",
  ],
];

export function HowSteps() {
  const [tab, setTab] = useState<SetupTabKey>("playwright");
  const current: SetupTab = SETUP_TABS[tab];
  return (
    <section id="how" className="scroll-mt-16">
      <div className={`${SECTION} grid grid-cols-2 gap-16 max-lg:grid-cols-1`}>
        <div>
          <LeadCopy
            title="Works with the tests you already have."
            className="max-w-[520px]"
          >
            No token to copy on GitHub Actions. The first build on your default
            branch becomes the baseline.
          </LeadCopy>
          <ol className="mt-10 flex flex-col">
            {HOW_STEPS.map(([title, text], index) => (
              <li
                key={title}
                className="flex gap-4 border-t border-dotted border-field-border/50 py-5"
              >
                <span className="mono text-muted tabular-nums">
                  {index + 1}
                </span>
                <span>
                  <span className="text-base font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="border-t border-dotted border-field-border/50 pt-5 text-sm text-muted">
            Using a coding agent? The{" "}
            <Link to="/docs" className="text-link">
              quickstart
            </Link>{" "}
            has a prompt that sets it up for you.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:pt-2">
          <div
            role="tablist"
            aria-label="Where it runs"
            className="flex flex-wrap gap-1 self-start rounded-control bg-surface-2 p-0.5"
          >
            {(Object.keys(SETUP_TABS) as SetupTabKey[]).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                data-umami-event="Setup tab"
                data-umami-event-tab={value}
                onClick={() => setTab(value)}
                className={`flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors duration-100 ${
                  tab === value
                    ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                    : "text-muted hover:text-text"
                }`}
              >
                {SETUP_TABS[value].icon}
                {SETUP_TABS[value].label}
              </button>
            ))}
          </div>
          {current.blocks.map((block) => (
            <CodeBlock
              key={block.file}
              fileName={block.file}
              {...block.snippet}
            />
          ))}
          <p className="text-xs text-muted">
            {current.note}{" "}
            <Link
              to="/docs/$slug"
              params={{ slug: current.slug }}
              className="text-link"
              data-umami-event="Setup guide"
              data-umami-event-tab={tab}
            >
              Read the {current.label} guide
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export const ACCESS: [string, string][] = [
  ["Read", "See builds, baselines and snapshot history"],
  ["Write", "Approve and reject changes"],
  ["Admin", "Change project settings and tokens"],
  ["Account owner", "Change the plan and billing"],
];

const CAPABILITIES = [
  "Builds and baselines",
  "Approve and reject",
  "Project settings",
  "Plan and billing",
];

const ROLES: [string, number][] = [
  ["Owner", 4],
  ["Admin", 3],
  ["Write", 2],
  ["Read", 1],
];

const TEAM_FACTS: [Icon, string][] = [
  [
    UserMinusIcon,
    "Remove someone from the repository and they lose access here too.",
  ],
  [
    LockSimpleIcon,
    "Private builds show only to people who can read the repository on GitHub.",
  ],
];

export function TeamSection() {
  return (
    <section
      className={`${SECTION} grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-16 max-lg:grid-cols-1 max-lg:gap-10`}
    >
      <div>
        <LeadCopy title="Access follows GitHub." className="max-w-[520px]">
          There are no invites and no seats. People can do what their role on
          the repository allows.
        </LeadCopy>
        <ul className="mt-10 flex flex-col">
          {TEAM_FACTS.map(([FactIcon, text]) => (
            <li
              key={text}
              className="flex gap-3 border-t border-dotted border-field-border/50 py-4 text-sm text-muted"
            >
              <FactIcon size={16} className="mt-0.5 shrink-0 text-text" />
              {text}
            </li>
          ))}
        </ul>
        <Link
          to="/docs/$slug"
          params={{ slug: "security" }}
          hash="who-can-see-and-do-what"
          className="mt-2 inline-flex items-center gap-1 text-sm text-link"
        >
          Who can see and do what
          <ArrowRightIcon size={12} />
        </Link>
      </div>
      <table className="w-full table-fixed text-sm max-sm:hidden">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="w-28 pb-3 font-medium">Role on GitHub</th>
            {CAPABILITIES.map((capability) => (
              <th key={capability} className="pb-3 font-medium">
                {capability}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map(([role, allowed]) => (
            <tr
              key={role}
              className="border-t border-dotted border-field-border/50"
            >
              <th scope="row" className="py-4 text-left font-medium">
                {role}
              </th>
              {CAPABILITIES.map((capability, index) => (
                <td key={capability} className="py-4">
                  {index < allowed ? (
                    <>
                      <CheckIcon
                        size={16}
                        weight="bold"
                        aria-hidden
                        className="text-approved"
                      />
                      <span className="sr-only">Yes</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden className="text-subtle">
                        -
                      </span>
                      <span className="sr-only">No</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col sm:hidden">
        {ROLES.map(([role, allowed]) => (
          <li
            key={role}
            className="border-t border-dotted border-field-border/50 py-4"
          >
            <span className="block text-sm font-medium">{role}</span>
            <span className="mt-1 block text-sm text-muted">
              {CAPABILITIES.slice(0, allowed)
                .map((capability, index) =>
                  index === 0 ? capability : capability.toLowerCase(),
                )
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const PIPELINES: [string, string][] = [
  [
    "Sharded suites",
    "Each shard uploads its part, and the check reports once, after the last one. Use --shard 2/4, or --shard auto with a finalize step.",
  ],
  [
    "New pushes and rebases",
    "An image approved once on a pull request stays approved on the next push. A rejected image comes back as pending, with a note.",
  ],
  [
    "Squash and rebase merges",
    "The build on main finds the pull request it came from, and marks changes that were never approved there.",
  ],
  [
    "Several suites",
    "Storybook and Playwright in one repository each get their own baselines and their own check, like stateofpixel/storybook.",
  ],
  [
    "Partial runs",
    "Pass --subset when only some tests ran, and missing snapshots are not reported as removed. The Playwright reporter does this on its own when a test fails.",
  ],
  [
    "Flaky screenshots",
    "A snapshot that flips back and forth on main, or differs between two builds of the same commit, is marked as looking flaky on the review page.",
  ],
  [
    "Our outages",
    "If stateofpixel is down or rate limited, the upload warns and exits 0. Pass --strict to fail instead.",
  ],
  [
    "Running out of storage",
    `The CLI warns at ${facts.storageWarning}. After ${facts.graceDays} days over the limit, new images are not stored and the check passes with a note, so CI keeps passing.`,
  ],
  [
    "Large suites",
    `Up to ${facts.snapshotsPerBuild} snapshots a build. An unchanged screenshot costs one hash, not an upload.`,
  ],
];

/* Promises */

export const PROMISES: [string, string][] = [
  [
    "Your code stays in your CI.",
    "The CLI sends PNGs, their names and hashes, diff results, snapshot metadata, and git and CI metadata.",
  ],
  [
    "Your pipeline never waits on us.",
    "If stateofpixel is down, the upload step warns and exits 0.",
  ],
  [
    "Your bill never grows on its own.",
    `Plans are fixed, with no overage. ${facts.graceDays} days after the storage limit, new images are not stored and the check passes with a note.`,
  ],
  [
    "Your tests stay as they are.",
    "The CLI reads any folder of PNG files, and compare runs on your machine with no account.",
  ],
];

/* Switch */

export function SwitchStrip() {
  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-xl bg-surface-2 p-8 max-sm:p-5">
        <LeadCopy title="Coming from another tool?" className="max-w-[520px]">
          Switch in one pull request. Your first build on the default branch
          becomes the baseline. The{" "}
          <Link
            to="/docs/$slug"
            params={{ slug: "moving" }}
            className="text-link"
          >
            moving guide
          </Link>{" "}
          has the details.
        </LeadCopy>
        <ul className="flex flex-wrap gap-2">
          {COMPETITORS.map((competitor) => (
            <li key={competitor.slug}>
              <Link
                to="/compare/$slug"
                params={{ slug: competitor.slug }}
                hash="switch"
                className={buttonClass("secondary")}
                data-umami-event="Switch strip"
                data-umami-event-competitor={competitor.slug}
              >
                <img
                  src={competitor.logo}
                  alt=""
                  width={16}
                  height={16}
                  className="rounded-[22%] ring-1 ring-border"
                />
                From {competitor.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* FAQ */

export const FAQ: [string, string][] = [
  [
    "What do you receive from my CI?",
    "PNG files, snapshot names and their SHA-256 hashes, diff results from your runner, metadata your tests attach to snapshots, git metadata (commit, commit message, branch, base branch, pull request number, recent ancestor commits) and the CI run URL. We never receive source code, and we never run it.",
  ],
  [
    "What GitHub permissions does the app ask for?",
    "Commit statuses write, to set the check. Pull requests read and write, where read finds the PR number, base branch and squash merges, and write is not used for now. Contents read, which GitHub requires for the compare API we use to find the baseline commit. Metadata read, which every app has. Email addresses read, so you can sign in with GitHub. The app also asks for Checks write and Actions read, which it does not use for now.",
  ],
  [
    "Who can approve changes?",
    "Anyone with write access to the repository on GitHub. There are no seats, so the whole team can review.",
  ],
  [
    "Which test runners work?",
    "Anything that writes PNG files: Playwright, Cypress, BackstopJS or native app screenshots. The CLI captures Storybook stories on its own. The file path becomes the snapshot name.",
  ],
  [
    "How do you handle flaky screenshots?",
    "Screenshots render in your own CI, so they match what your tests see. The CLI ignores anti-aliasing by default and has a color threshold. A snapshot that flips back and forth on main is marked as looking flaky, with a link to the fixes. For stable renders, run capture in the Playwright Docker image and disable animations.",
  ],
  [
    "What happens when stateofpixel is down?",
    "The upload step prints a warning and exits 0, so your pipeline keeps going. Pass --strict if you want it to fail instead.",
  ],
  [
    "Do you support GitLab or Bitbucket?",
    "No. stateofpixel is GitHub only. Other CI providers work with a project token, as long as the repository is on GitHub.",
  ],
  [
    "Is it open source?",
    "Yes. The CLI, the server and the web app are MIT licensed, with their source at github.com/VaibhavAcharya/stateofpixel.",
  ],
  [
    "What is in the Free plan?",
    `${facts.freeStorage} of stored screenshots. Snapshots, builds, projects and reviewers are not charged. No card needed. Pull request images are kept ${facts.retentionDays} days by default.`,
  ],
  [
    "What happens when the free storage is full?",
    `The CLI and the account pages warn at ${facts.storageWarning}. At 100%, a ${facts.graceDays} day grace period starts. After it, new images are not stored and the check passes with a note, so CI keeps passing. Upgrade, or lower retention to free space.`,
  ],
  [
    "What happens if I cancel a paid plan?",
    `Cancel at the next billing date and the plan stays until the end of the billing period. Then the account moves to the Free plan with ${facts.freeStorage} of storage.`,
  ],
];

export function FinalStartFree() {
  return (
    <section className="border-t border-border bg-bg">
      <div
        className={`${SECTION} grid grid-cols-2 items-end gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <h2 className={DISPLAY}>
            Start free.
            <br />
            <span className="text-muted">
              Pay when you pass{" "}
              <span className="whitespace-nowrap">{facts.freeStorage}.</span>
            </span>
          </h2>
          <ul className="mt-8 flex flex-col gap-2 text-base">
            {[
              "No card to start",
              "No charge for screenshots, builds or reviewers",
              "One upload step in your workflow",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon size={16} weight="bold" className="text-approved" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <AuthButton label="Start free with GitHub" />
            <Link to="/docs" className={buttonClass("ghost")}>
              Read the quickstart
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            <a
              href={REPO_URL}
              data-umami-event="GitHub"
              className="hover:text-text"
            >
              Open source, MIT.
            </a>
          </p>
        </div>
        <CodeBlock fileName=".github/workflows/visual.yml" {...workflow} />
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  ["Docs", "/docs"],
  ["Compare", "/compare"],
  ["Brand", "/brand"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refunds", "/refunds"],
] as const;

export function Footer() {
  return (
    <footer className="border-t border-dotted border-field-border/50">
      <div className="mx-auto flex min-h-16 max-w-[1448px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4 text-xs text-muted max-sm:px-4">
        <Wordmark />
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {FOOTER_LINKS.map(([label, to]) => (
            <Link key={to} to={to} className="hover:text-text">
              {label}
            </Link>
          ))}
          <a
            href={REPO_URL}
            data-umami-event="GitHub"
            className="hover:text-text"
          >
            Open source
          </a>
          <a href={CHANGELOG_URL} className="hover:text-text">
            CLI changelog
          </a>
        </nav>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          data-umami-event="Email"
          className="ml-auto hover:text-text max-sm:ml-0"
        >
          {SUPPORT_EMAIL}
        </a>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <HeaderNav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
