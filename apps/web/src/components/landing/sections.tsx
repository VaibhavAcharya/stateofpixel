import {
  ArrowRightIcon,
  CheckIcon,
  GearSixIcon,
  GithubLogoIcon,
  ListIcon,
  LockSimpleIcon,
  TerminalWindowIcon,
  UserMinusIcon,
} from "@phosphor-icons/react/ssr";
import { Link, useLocation } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  Button,
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameHeader,
  CardFrameTitle,
  cn,
  Separator,
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "uiofcraft";
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
import { AuthButton, SignInButton } from "../SignIn";
import { type Icon, Kbd, LeadCopy, Logo as Mark, Wordmark } from "../ui";
import { CompanyOfCraftMark } from "./CompanyOfCraftMark";
import { ReviewDemo } from "./ReviewDemo";

export const WIDE = "mx-auto w-full max-w-[1416px] px-4 sm:px-6";
export const SECTION = `${WIDE} py-16 sm:py-24`;
export const LEAD = "text-pretty text-lg text-muted-foreground";

export const DISPLAY =
  "text-balance font-heading font-semibold text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.015em]";

export const MUTED_BAND = "bg-muted/80";

/* Header */

export const REPO_URL = "https://github.com/VaibhavAcharya/stateofpixel";
export const CHANGELOG_URL = `${REPO_URL}/blob/main/packages/cli/CHANGELOG.md`;

const NAV = [
  { label: "How it works", href: "/#how", match: null },
  { label: "Pricing", href: "/#pricing", match: null },
  { label: "Compare", href: "/compare", match: "/compare" },
  { label: "Docs", href: "/docs", match: "/docs" },
] as const;

export function HeaderNav() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <header className="sticky top-0 z-40 w-full bg-sidebar/80 backdrop-blur-sm before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border/64">
      <div className={`${WIDE} relative flex h-16 items-center gap-2`}>
        <Link
          to="/"
          aria-label="stateofpixel home"
          className="-ms-1 rounded-lg px-1 py-1 pe-4 lg:pe-6"
        >
          <span className="flex items-center gap-2 font-heading font-semibold text-lg tracking-[-0.01em]">
            <Mark size={24} />
            stateofpixel
          </span>
        </Link>
        <nav
          aria-label="Main"
          className="flex items-center gap-1 max-lg:hidden"
        >
          {NAV.map(({ label, href, match }) => {
            const active = match !== null && pathname.startsWith(match);
            return (
              <Button
                key={href}
                variant="ghost"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
                render={
                  <a href={href} aria-current={active ? "page" : undefined} />
                }
              >
                {label}
              </Button>
            );
          })}
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
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground max-md:hidden"
        render={<a href={REPO_URL} data-umami-event="GitHub" />}
      >
        <GithubLogoIcon weight="fill" />
        Open source
      </Button>
      <Separator orientation="vertical" className="mx-1 h-5 max-md:hidden" />
      {!isLoading && !isAuthenticated && (
        <SignInButton
          label="Sign in"
          variant="ghost"
          className="max-sm:hidden"
        />
      )}
      <AuthButton label="Start free" />
      <MobileNav />
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menu"
            className="lg:hidden"
          />
        }
      >
        <ListIcon />
      </SheetTrigger>
      <SheetPopup side="right" className="w-[min(320px,100vw)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-heading">
            <Mark size={20} />
            stateofpixel
          </SheetTitle>
        </SheetHeader>
        <SheetPanel>
          <nav aria-label="Main" className="flex flex-col">
            {[
              ...NAV,
              { label: "Open source", href: REPO_URL, match: null },
            ].map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center border-b font-medium text-base"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-2">
            <AuthButton label="Start free with GitHub" className="w-full" />
            {!isLoading && !isAuthenticated && (
              <SignInButton
                label="Sign in"
                variant="secondary"
                className="w-full"
              />
            )}
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}

/* Hero */

export function HeroCentered() {
  return (
    <section className="overflow-x-clip pt-10 sm:pt-14">
      <div
        className={`${WIDE} flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10`}
      >
        <h1 className="text-balance font-heading font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-none tracking-[-0.02em] lg:col-span-8">
          Catch UI regressions before they merge.
        </h1>
        <div className="flex flex-col items-start gap-5 lg:col-span-4 lg:pb-1.5">
          <p className={LEAD}>
            Every pull request gets a visual check. Your CI takes the
            screenshots, a person approves each change.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AuthButton label="Start free with GitHub" />
            <Button
              variant="outline"
              render={<a href="#pricing" data-umami-event="Hero see pricing" />}
            >
              See pricing
              <ArrowRightIcon />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Free up to {facts.freeStorage}. No card. Playwright, Storybook or
            any folder of PNGs.
          </p>
        </div>
      </div>
      <DemoSection />
    </section>
  );
}

/* Product */

export function DemoSection() {
  return (
    <div id="demo" className={`${WIDE} mt-10 scroll-mt-20 sm:mt-12`}>
      <CardFrame className="w-full min-w-0 shadow-[0_32px_64px_-32px] shadow-black/24 dark:shadow-black/64">
        <CardFrameHeader className="py-3 max-lg:hidden">
          <CardFrameTitle>Same review page as the app</CardFrameTitle>
          <CardFrameAction>
            <DemoKeys />
          </CardFrameAction>
        </CardFrameHeader>
        <Card className="checker min-w-0 overflow-hidden p-6 max-md:p-3">
          <ReviewDemo />
        </Card>
      </CardFrame>
    </div>
  );
}

function DemoKeys() {
  return (
    <p className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-muted-foreground text-xs">
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
  return (
    <img
      src={`/logos/${name}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
    />
  );
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
    icon: <GearSixIcon size={14} className="text-muted-foreground" />,
    note: "Create a project token in the project settings and set it as STATEOFPIXEL_TOKEN.",
    slug: "other-ci",
    blocks: [{ file: "ci.sh", snippet: otherCi }],
  },
  local: {
    label: "Local",
    icon: <TerminalWindowIcon size={14} className="text-muted-foreground" />,
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
              <li key={title} className="flex gap-4 border-t py-5">
                <span className="mono text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span>
                  <span className="text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="border-t pt-5 text-sm text-muted-foreground">
            Using a coding agent? The{" "}
            <Link to="/docs" className="text-link">
              quickstart
            </Link>{" "}
            has a prompt that sets it up for you.
          </p>
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as SetupTabKey)}
          className="min-w-0 gap-3 lg:pt-2"
        >
          <TabsList aria-label="Where it runs" className="flex-wrap">
            {(Object.keys(SETUP_TABS) as SetupTabKey[]).map((value) => (
              <TabsTab
                key={value}
                value={value}
                data-umami-event="Setup tab"
                data-umami-event-tab={value}
              >
                {SETUP_TABS[value].icon}
                {SETUP_TABS[value].label}
              </TabsTab>
            ))}
          </TabsList>
          <TabsPanel value={tab} className="flex min-w-0 flex-col gap-3">
            {current.blocks.map((block) => (
              <CodeBlock
                key={block.file}
                fileName={block.file}
                {...block.snippet}
              />
            ))}
            <p className="text-xs text-muted-foreground">
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
          </TabsPanel>
        </Tabs>
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
    <section className={`${MUTED_BAND} scroll-mt-16`}>
      <div
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
                className="flex gap-3 border-t py-4 text-sm text-muted-foreground"
              >
                <FactIcon
                  size={16}
                  className="mt-0.5 shrink-0 text-foreground"
                />
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
            <tr className="text-left text-xs text-muted-foreground">
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
              <tr key={role} className="border-t">
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
                        <span aria-hidden className="text-muted-foreground">
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
            <li key={role} className="border-t py-4">
              <span className="block text-sm font-medium">{role}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {CAPABILITIES.slice(0, allowed)
                  .map((capability, index) =>
                    index === 0 ? capability : capability.toLowerCase(),
                  )
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-2xl border bg-card p-8 shadow-xs/5 max-sm:p-5">
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
              <Button
                variant="outline"
                render={
                  <Link
                    to="/compare/$slug"
                    params={{ slug: competitor.slug }}
                    hash="switch"
                    data-umami-event="Switch strip"
                    data-umami-event-competitor={competitor.slug}
                  />
                }
              >
                <img
                  src={competitor.logo}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  className="rounded-[22%] ring-1 ring-border"
                />
                From {competitor.name}
              </Button>
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
    <section className={MUTED_BAND}>
      <div
        className={`${SECTION} grid grid-cols-2 items-end gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <h2 className={DISPLAY}>
            Start free.
            <br />
            <span className="text-muted-foreground">
              Pay when you pass{" "}
              <span className="whitespace-nowrap">{facts.freeStorage}.</span>
            </span>
          </h2>
          <ul className="mt-8 flex flex-col gap-2 text-sm">
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
            <Button variant="ghost" render={<Link to="/docs" />}>
              Read the quickstart
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <a
              href={REPO_URL}
              data-umami-event="GitHub"
              className="hover:text-foreground"
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

type FooterLink =
  | {
      label: string;
      to:
        | "/"
        | "/docs"
        | "/compare"
        | "/image-diff"
        | "/brand"
        | "/privacy"
        | "/terms"
        | "/refunds";
      hash?: string;
    }
  | { label: string; href: string; event?: string };

const FOOTER_GROUPS: [string, FooterLink[]][] = [
  [
    "Product",
    [
      { label: "Docs", to: "/docs" },
      { label: "Pricing", to: "/", hash: "pricing" },
      { label: "Compare", to: "/compare" },
    ],
  ],
  [
    "Company",
    [
      { label: "Brand", to: "/brand" },
      { label: "Open source", href: REPO_URL, event: "GitHub" },
      { label: "CLI changelog", href: CHANGELOG_URL },
    ],
  ],
  [
    "Legal",
    [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Refunds", to: "/refunds" },
    ],
  ],
  ["Small free tools", [{ label: "Image diff", to: "/image-diff" }]],
];

function CompanyOfCraftLink({ className }: { className: string }) {
  return (
    <a
      href="https://companyofcraft.com"
      target="_blank"
      rel="noopener"
      data-umami-event="Company of Craft"
      className={`flex items-center gap-2 text-left hover:text-foreground ${className}`}
    >
      <CompanyOfCraftMark size={36} />
      <span className="leading-tight">
        A product by
        <br />
        <span className="text-foreground">Company of Craft</span>
      </span>
    </a>
  );
}

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className = "hover:text-foreground";
  if ("to" in link) {
    return (
      <Link to={link.to} hash={link.hash} className={className}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener"
      data-umami-event={link.event}
      className={className}
    >
      {link.label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="relative border-border/64 border-t bg-muted/32 py-12 text-muted-foreground sm:py-16">
      <div className={WIDE}>
        <div className="flex flex-wrap justify-between gap-x-12 gap-y-10 pb-12">
          <div className="flex flex-col gap-3">
            <span className="text-foreground">
              <Wordmark />
            </span>
            <p className="text-sm">Catch UI regressions before they merge.</p>
            <CompanyOfCraftLink className="mt-3 text-xs" />
          </div>
          <nav
            aria-label="Footer"
            className="grid grid-cols-4 gap-x-16 gap-y-10 max-md:grid-cols-2 max-md:gap-x-12"
          >
            {FOOTER_GROUPS.map(([label, links]) => (
              <div key={label} className="flex flex-col gap-3">
                <h2 className="font-medium text-foreground text-sm">{label}</h2>
                <ul className="flex flex-col gap-2 text-sm">
                  {links.map((link) => (
                    <li key={link.label}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-border/64 border-t pt-6 text-xs">
          <span>&copy; 2026 Company of Craft</span>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            data-umami-event="Email"
            className="hover:text-foreground"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-clip bg-sidebar">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-45 w-full max-w-[1440px] -translate-x-1/2 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border/64 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/64 max-[1440px]:hidden"
      />
      <HeaderNav />
      <main className="flex-1 bg-background">{children}</main>
      <Footer />
    </div>
  );
}
