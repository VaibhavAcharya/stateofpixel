import {
  ArrowRightIcon,
  CaretDownIcon,
  GearSixIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import checkoutTest from "../../snippets/checkout-test.ts?highlight";
import local from "../../snippets/local.sh?highlight";
import otherCi from "../../snippets/other-ci.sh?highlight";
import playwrightConfig from "../../snippets/playwright.config.ts?highlight";
import storybook from "../../snippets/storybook.yml?highlight";
import workflow from "../../snippets/workflow.yml?highlight";
import { CodeBlock, type Snippet } from "../CodeBlock";
import { AuthButton } from "../SignIn";
import { buttonClass, Kbd, LeadCopy, Wordmark } from "../ui";
import { ReviewDemo } from "./ReviewDemo";

export const WIDE = "mx-auto max-w-[1448px] px-6 max-sm:px-4";
export const SECTION = `${WIDE} py-24 max-sm:py-12`;
const LEAD =
  "text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl";
export const DISPLAY =
  "text-[clamp(40px,4.6vw,66px)] leading-[1.1] font-semibold tracking-[-0.045em] text-balance";

/* Header */

const NAV = [
  ["Demo", "/#demo"],
  ["How it works", "/#how"],
  ["Pricing", "/#pricing"],
  ["FAQ", "/#faq"],
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
        <div className="ml-auto">
          <AuthButton label="Sign in" />
        </div>
      </div>
    </header>
  );
}

/* Hero */

export function HeroDescriptive({ art }: { art: ReactNode }) {
  return (
    <section
      className={`${WIDE} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-12 pt-24 pb-16 max-lg:grid-cols-1 max-sm:pt-12`}
    >
      <div>
        <h1 className={`${DISPLAY} max-w-[16ch]`}>
          Visual regression testing that runs in your CI.
        </h1>
        <p className={`${LEAD} mt-6 max-w-[640px]`}>
          Your runners take the screenshots. We keep the baselines, show every
          pixel diff and set the GitHub check.{" "}
          <strong className="font-semibold text-text">
            You pay for storage, not snapshots or seats.
          </strong>
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AuthButton label="Install the GitHub App" />
          <a href="#demo" className={buttonClass("secondary")}>
            Try the review page
            <ArrowRightIcon size={14} className="text-muted" />
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">
          GitHub only. Playwright, Storybook or any folder of PNGs.
        </p>
      </div>
      <div aria-hidden className="max-lg:hidden">
        {art}
      </div>
    </section>
  );
}

/* Product */

function Checker({ children }: { children: ReactNode }) {
  return (
    <div className="checker rounded-xl p-12 ring-1 ring-border max-md:p-3">
      <div className="mx-auto max-w-[1180px]">{children}</div>
    </div>
  );
}

export function DemoSection() {
  return (
    <section id="demo" className={`${WIDE} scroll-mt-20`}>
      <Checker>
        <ReviewDemo />
        <DemoKeys />
      </Checker>
    </section>
  );
}

function DemoKeys() {
  return (
    <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted max-lg:hidden">
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
    </p>
  );
}

/* Setup */

function Logo({ name }: { name: string }) {
  return <img src={`/logos/${name}.svg`} alt="" width={14} height={14} />;
}

type SetupTab = {
  label: string;
  icon: ReactNode;
  note: string;
  blocks: { file: string; snippet: Snippet }[];
};

const SETUP_TABS = {
  playwright: {
    label: "Playwright",
    icon: <Logo name="playwright" />,
    note: "snapshot() waits for fonts, disables animations and hides the caret. The reporter uploads when the run ends, once per shard.",
    blocks: [
      { file: "playwright.config.ts", snippet: playwrightConfig },
      { file: "tests/checkout.spec.ts", snippet: checkoutTest },
    ],
  },
  storybook: {
    label: "Storybook",
    icon: <Logo name="storybook" />,
    note: "Captures every story at each width, named like Button/Primary [chromium 1280]. Needs Playwright in the project.",
    blocks: [{ file: ".github/workflows/visual.yml", snippet: storybook }],
  },
  actions: {
    label: "GitHub Actions",
    icon: <Logo name="github-actions" />,
    note: "Point the CLI at the folder your tests write screenshots to. The file path becomes the snapshot name.",
    blocks: [{ file: ".github/workflows/visual.yml", snippet: workflow }],
  },
  other: {
    label: "Other CI",
    icon: <GearSixIcon size={14} className="text-muted" />,
    note: "Create a project token in the project settings and set it as STATEOFPIXEL_TOKEN.",
    blocks: [{ file: "ci.sh", snippet: otherCi }],
  },
  local: {
    label: "Local",
    icon: <TerminalWindowIcon size={14} className="text-muted" />,
    note: "Compare two folders on your machine and open an HTML report. No account needed.",
    blocks: [{ file: "terminal", snippet: local }],
  },
} satisfies Record<string, SetupTab>;

type SetupTabKey = keyof typeof SETUP_TABS;

export function HowSteps() {
  const [tab, setTab] = useState<SetupTabKey>("playwright");
  const current: SetupTab = SETUP_TABS[tab];
  return (
    <section id="how" className="scroll-mt-16">
      <div className={`${SECTION} grid grid-cols-2 gap-16 max-lg:grid-cols-1`}>
        <div>
          <LeadCopy
            title="Works with the tests you have."
            className="max-w-[520px]"
          >
            No token to copy on GitHub Actions. The first build on your default
            branch becomes the baseline.
          </LeadCopy>
          <ol className="mt-10 flex flex-col">
            {[
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
            ].map(([title, text], index) => (
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
          <p className="text-xs text-muted">{current.note}</p>
        </div>
      </div>
    </section>
  );
}

const ACCESS: [string, string][] = [
  ["Read", "See builds, baselines and snapshot history"],
  ["Write", "Approve and reject changes"],
  ["Admin", "Change project settings and tokens"],
  ["Account owner", "Change the plan and billing"],
];

export function TeamSection() {
  return (
    <section
      className={`${SECTION} grid grid-cols-[1fr_1.2fr] gap-12 max-lg:grid-cols-1`}
    >
      <LeadCopy title="Your team is already set up." className="max-w-[520px]">
        Access comes from GitHub, so there are no invites and no seats to buy.
        Remove someone from the repository and they lose access here within 5
        minutes.
      </LeadCopy>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dotted border-field-border/50 text-left text-xs text-muted">
            <th className="pb-3 font-medium">On GitHub</th>
            <th className="pb-3 font-medium">On stateofpixel</th>
          </tr>
        </thead>
        <tbody>
          {ACCESS.map(([role, can]) => (
            <tr
              key={role}
              className="border-b border-dotted border-field-border/50"
            >
              <td className="py-4 pr-6 font-medium whitespace-nowrap">
                {role}
              </td>
              <td className="py-4 text-muted">{can}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const PIPELINES: [string, string][] = [
  [
    "Sharded suites",
    "Each shard uploads its part, and the check reports once, after the last one. Use --shard 2/4, or --shard auto with a finalize step.",
  ],
  [
    "New pushes and rebases",
    "An image approved once on a pull request stays approved on the next push. A rejected image comes back as pending, with a note.",
  ],
  [
    "Our outages",
    "If stateofpixel is down or rate limited, the upload warns and exits 0. Pass --strict to fail instead.",
  ],
  [
    "Running out of storage",
    "The CLI warns at 80%. After 14 days over the limit, new images are not stored and the check passes with a note, so CI keeps passing.",
  ],
  [
    "Large suites",
    "Up to 20,000 snapshots a build. An unchanged screenshot costs one hash, not an upload.",
  ],
];

export function PipelinesSection() {
  return (
    <section className={SECTION}>
      <LeadCopy title="Made for real pipelines." className="max-w-[720px]">
        Sharding, rebases, outages and limits are handled by default.
      </LeadCopy>
      <DottedRows items={PIPELINES} />
    </section>
  );
}

function DottedRows({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-12 border-t border-dotted border-field-border/50">
      {items.map(([title, text]) => (
        <li
          key={title}
          className="grid grid-cols-[minmax(0,420px)_1fr] gap-x-8 border-b border-dotted border-field-border/50 py-5 max-md:grid-cols-1"
        >
          <span className="text-xl font-semibold tracking-[-0.025em]">
            {title}
          </span>
          <span className="text-sm text-muted md:pt-1.5">{text}</span>
        </li>
      ))}
    </ul>
  );
}

export function WhatWeDont() {
  const items: [string, string][] = [
    [
      "We don't run browsers.",
      "Your CI renders, so there is no second renderer to disagree with it.",
    ],
    [
      "We don't see your code.",
      "The CLI sends PNGs, their names and hashes, diff results, and git and CI metadata.",
    ],
    [
      "We don't count snapshots.",
      "Or seats, or builds. Storage is the only line on the bill.",
    ],
    [
      "We don't block your CI.",
      "If the service is down, the upload step warns and passes.",
    ],
  ];
  return (
    <section className={SECTION}>
      <LeadCopy title="What we don't do." className="max-w-[720px]">
        Every feature we skip is a cost we don't pass on.
      </LeadCopy>
      <DottedRows items={items} />
    </section>
  );
}

/* FAQ */

const FAQ: [string, string][] = [
  [
    "What do you receive from my CI?",
    "PNG files, snapshot names and their SHA-256 hashes, diff results from your runner, git metadata (commit, branch, base branch, pull request number, recent ancestor commits) and the CI run URL. We never receive source code, and we never run it.",
  ],
  [
    "What GitHub permissions does the app ask for?",
    "Commit statuses write, to set the check. Pull requests read, for the PR number and base branch. Contents read, which GitHub requires for the compare API we use to find the baseline commit. Metadata read, which every app has.",
  ],
  [
    "Who can approve changes?",
    "Anyone with write access to the repository on GitHub. There are no seats, so the whole team can review.",
  ],
  [
    "Which test runners work?",
    "Anything that writes PNG files. Playwright, Storybook with a capture script, Cypress, BackstopJS or native app screenshots. The file path becomes the snapshot name.",
  ],
  [
    "How do you handle flaky screenshots?",
    "Screenshots render in your own CI, so they match what your tests see. The CLI ignores anti-aliasing by default and has a color threshold. For stable renders, run capture in the Playwright Docker image and disable animations.",
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
    "Not yet. The CLI and the server are closed source for now.",
  ],
  [
    "What happens if I cancel a paid plan?",
    "The plan stays until the end of the billing period. Then the account moves to the Free plan with 10 GB of storage.",
  ],
];

export function FaqList() {
  return (
    <section
      id="faq"
      className={`${SECTION} scroll-mt-16 grid grid-cols-[1fr_2fr] gap-12 max-lg:grid-cols-1`}
    >
      <LeadCopy title="Questions." className="max-w-[360px]">
        The ones a security review asks first.
      </LeadCopy>
      <div className="border-t border-dotted border-field-border/50">
        {FAQ.map(([question, answer]) => (
          <details
            key={question}
            className="group border-b border-dotted border-field-border/50"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium [&::-webkit-details-marker]:hidden">
              {question}
              <CaretDownIcon
                size={14}
                className="shrink-0 text-muted transition-transform duration-180 group-open:rotate-180"
              />
            </summary>
            <p className="max-w-[65ch] pb-5 text-sm text-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalWithSnippet() {
  return (
    <section className="border-t border-border bg-bg">
      <div
        className={`${SECTION} grid grid-cols-2 items-end gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <p className={DISPLAY}>
            Every pixel, reviewed.
            <br />
            <span className="text-muted">Nothing ships by surprise.</span>
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <AuthButton label="Install the GitHub App" />
            <a href="#demo" className={buttonClass("ghost")}>
              Try the demo again
            </a>
          </div>
        </div>
        <CodeBlock fileName=".github/workflows/visual.yml" {...workflow} />
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
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
