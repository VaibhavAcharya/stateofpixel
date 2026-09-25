import { ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { SUPPORT_EMAIL } from "../../lib/supportEmail";
import local from "../../snippets/local.sh?highlight";
import otherCi from "../../snippets/other-ci.sh?highlight";
import workflow from "../../snippets/workflow.yml?highlight";
import { CodeBlock } from "../CodeBlock";
import { AuthButton } from "../SignIn";
import { buttonClass, Kbd, LeadCopy, Wordmark } from "../ui";
import { ReviewDemo } from "./ReviewDemo";

const WIDE = "mx-auto max-w-[1448px] px-6 max-sm:px-4";
const SECTION = `${WIDE} py-24 max-sm:py-12`;
const LEAD =
  "text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl";
const DISPLAY =
  "text-[clamp(40px,4.6vw,66px)] leading-[1.1] font-semibold tracking-[-0.045em] text-balance";

const CLI_OUTPUT = `$ npx stateofpixel upload screenshots
stateofpixel  build #412  pricing-cards vs main (#409)
  219 snapshots  214 unchanged  4 changed  1 added  0 removed
  uploaded 9 images (0.1 MB) in 1.9 s
  review: https://stateofpixel.com/acme/web/builds/412`;

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

/* How it works */

const LANES: { title: string; where: string; items: string[] }[] = [
  {
    title: "Your runner",
    where: "GitHub Actions or any CI",
    items: [
      "Renders screenshots with your browser and fonts",
      "Hashes every PNG with SHA-256",
      "Diffs changed images with odiff",
    ],
  },
  {
    title: "stateofpixel",
    where: "Stores bytes, never renders",
    items: [
      "Picks the baseline from your git history",
      "Answers which hashes it has not seen",
      "Stores only those images and their diffs",
    ],
  },
  {
    title: "GitHub",
    where: "Checks write, pull requests read",
    items: [
      "Check run on the commit, linked to the review",
      "Action required while changes wait",
      "Success when every change is approved",
    ],
  },
];

export function HowFlow() {
  return (
    <section id="how" className={`${SECTION} scroll-mt-16`}>
      <LeadCopy
        title="Your code never leaves your runner."
        className="max-w-[720px]"
      >
        Only PNGs, their names and the commit go over the wire. Unchanged
        screenshots cost one hash in a JSON body.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-3 max-md:grid-cols-1">
        {LANES.map((lane, index) => (
          <div
            key={lane.title}
            className="relative border-dotted border-field-border/50 py-6 pr-8 md:not-first:pl-8 md:not-last:border-r max-md:border-b"
          >
            <p className="text-2xs font-medium text-muted uppercase tracking-wide tabular-nums">
              0{index + 1}
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em]">
              {lane.title}
            </h3>
            <p className="text-xs text-muted">{lane.where}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {lane.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-text" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figure className="mt-10 overflow-hidden rounded-md bg-surface-2 shadow-[inset_0_0_0_1px_var(--color-border)]">
        <figcaption className="flex h-10 items-center border-b border-border px-4 text-xs text-muted">
          CI log, for the demo build above
        </figcaption>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-[1.8]">
          <code>{CLI_OUTPUT}</code>
        </pre>
      </figure>
    </section>
  );
}

export function HowSteps() {
  const [tab, setTab] = useState<"actions" | "other" | "local">("actions");
  const snippet = { actions: workflow, other: otherCi, local }[tab];
  const file = {
    actions: ".github/workflows/visual.yml",
    other: "ci.sh",
    local: "terminal",
  }[tab];
  return (
    <section className="border-y border-border bg-bg">
      <div className={`${SECTION} grid grid-cols-2 gap-16 max-lg:grid-cols-1`}>
        <div>
          <LeadCopy title="Set up in three steps." className="max-w-[520px]">
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
                "Add one step after your tests",
                "Point the CLI at the folder your tests write screenshots to.",
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
        <div className="flex flex-col gap-3 lg:pt-2">
          <div
            role="tablist"
            aria-label="Where it runs"
            className="flex gap-1 self-start rounded-control bg-surface-2 p-0.5"
          >
            {(
              [
                ["actions", "GitHub Actions"],
                ["other", "Other CI"],
                ["local", "Local"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`h-7 rounded-sm px-3 text-xs font-medium transition-colors duration-100 ${
                  tab === value
                    ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                    : "text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <CodeBlock fileName={file} {...snippet} />
        </div>
      </div>
    </section>
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
    "Checks write, to set the check. Pull requests read, for the PR number and base branch. Contents read, which GitHub requires for the compare API we use to find the baseline commit. Metadata read, which every app has.",
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

/* Status */

const SHIPPED = [
  "CLI upload with hash dedupe and local odiff diffs",
  "GitHub App, OIDC sign-in for Actions, project tokens",
  "Baselines from git history, auto-approve on main",
  "Review page with four views and keyboard shortcuts",
  "GitHub check runs",
  "Sharding and a finalize command",
  "Approval carry-over across rebases",
  "Storybook capture command and Playwright reporter",
];

const NEXT = [
  "Retention and a usage page",
  "PR comment summary",
  "Tokenless auth for fork PRs",
  "Flaky snapshot detection",
];

export function StatusSection() {
  return (
    <section className={SECTION}>
      <LeadCopy title="Early, and built in the open." className="max-w-[720px]">
        stateofpixel tests itself: every pull request in our repo runs through
        it. Here is where it stands.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-2 gap-12 max-md:grid-cols-1">
        <StatusList title="Shipped" items={SHIPPED} done />
        <StatusList title="Next" items={NEXT} />
      </div>
    </section>
  );
}

function StatusList({
  title,
  items,
  done = false,
}: {
  title: string;
  items: string[];
  done?: boolean;
}) {
  return (
    <div>
      <h3 className="border-b border-dotted border-field-border/50 pb-3 text-sm font-medium text-muted">
        {title}
      </h3>
      <ul>
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 border-b border-dotted border-field-border/50 py-3 text-sm"
          >
            <span
              className={`size-2 shrink-0 rounded-full ${done ? "bg-approved" : "ring-1 ring-field-border ring-inset"}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
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
