import {
  ArrowRightIcon,
  BracketsCurlyIcon,
  BrowsersIcon,
  CaretDownIcon,
  CaretRightIcon,
  CircleHalfIcon,
  CloudSlashIcon,
  CodeIcon,
  DatabaseIcon,
  GitCommitIcon,
  GithubLogoIcon,
  HashIcon,
  ImageIcon,
  KeyIcon,
  LinkSimpleIcon,
  LockSimpleIcon,
  ReceiptIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Button,
} from "uiofcraft";
import { findDoc } from "../../content/docs";
import { track } from "../../lib/analytics";
import { BOOKING_URL } from "../../lib/booking";
import { facts } from "../docs/facts";
import { type Icon, LeadCopy } from "../ui";
import { FAQ, MUTED_BAND, SECTION } from "./sections";

const DOTTED = "border-border";

const ANSWERS = new Map(FAQ);

const ANSWERED_ABOVE = [
  "What do you receive from my CI?",
  "What happens when stateofpixel is down?",
  "What happens when the free storage is full?",
];

export const QUESTIONS = FAQ.filter(
  ([question]) => !ANSWERED_ABOVE.includes(question),
);

function ListTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold tracking-[-0.01em]">{children}</h3>
  );
}

function FaqAccordion({
  title,
  questions,
  columns = 1,
}: {
  title: string;
  questions: string[];
  columns?: 1 | 2;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const allOpen = open.length === questions.length;
  const change = (stack: string[], next: string[]) => {
    for (const question of next) {
      if (!open.includes(question)) {
        track("FAQ open", { question });
      }
    }
    setOpen((current) => [
      ...current.filter((item) => !stack.includes(item)),
      ...next,
    ]);
  };
  const half = Math.ceil(questions.length / columns);
  const stacks =
    columns === 1
      ? [questions]
      : [questions.slice(0, half), questions.slice(half)];
  return (
    <div>
      <div className="flex h-8 items-center justify-between gap-4">
        <ListTitle>{title}</ListTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(allOpen ? [] : questions)}
          data-umami-event={allOpen ? undefined : "FAQ open all"}
        >
          {allOpen ? "Close all" : "Open all"}
        </Button>
      </div>
      <div
        className={`mt-4 grid gap-x-12 ${columns === 2 ? "grid-cols-2 max-lg:grid-cols-1" : ""}`}
      >
        {stacks.map((stack) => (
          <Accordion
            key={stack[0]}
            multiple
            value={open.filter((question) => stack.includes(question))}
            onValueChange={(next) => change(stack, next as string[])}
            className={`border-t ${DOTTED} max-lg:not-first:border-t-0`}
          >
            {stack.map((question) => (
              <AccordionItem
                key={question}
                value={question}
                className="last:border-b"
              >
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionPanel className="max-w-[65ch] pb-5">
                  {ANSWERS.get(question)}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        ))}
      </div>
    </div>
  );
}

function DocLink({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link
      to="/docs/$slug"
      params={{ slug }}
      data-umami-event="FAQ docs link"
      data-umami-event-doc={slug}
      className="group/doc inline-flex items-center gap-1 text-sm text-link"
    >
      {children}
      <ArrowRightIcon
        size={12}
        className="transition-transform duration-180 ease-out-strong group-hover/doc:translate-x-0.5"
      />
    </Link>
  );
}

/* Data flow */

const STAYS: [Icon, string, string][] = [
  [CodeIcon, "Source code", "Never sent, and never run on our side."],
  [
    BrowsersIcon,
    "Tests and browsers",
    "Screenshots render in your own CI, so they match what your tests see.",
  ],
  [
    KeyIcon,
    "Secrets",
    "On GitHub Actions the CLI signs in with OIDC, so there is no secret to store.",
  ],
];

const SENT: [Icon, string, string, string][] = [
  [
    ImageIcon,
    "PNG files",
    "checkout.png",
    `The screenshots your tests wrote, up to ${facts.imageSize} each. An unchanged screenshot costs one hash, not an upload.`,
  ],
  [
    HashIcon,
    "Names and SHA-256 hashes",
    "Button/Primary",
    "The file path becomes the snapshot name. Each upload is checked against its hash.",
  ],
  [
    CircleHalfIcon,
    "Diff results",
    "0.42%",
    "The CLI diffs changed snapshots on your machine before the upload, with odiff or pixelmatch.",
  ],
  [
    BracketsCurlyIcon,
    "Snapshot metadata",
    ".meta.json",
    `Metadata your tests attach, up to ${facts.metadataSize} per snapshot. It is shown on the build page and never changes how snapshots match.`,
  ],
  [
    GitCommitIcon,
    "Git metadata",
    "feat/header",
    `Commit, commit message, branch, base branch, pull request number and up to ${facts.ancestors} ancestor commits, to find the baseline.`,
  ],
  [
    LinkSimpleIcon,
    "CI run URL",
    "actions/runs",
    "A link from the build back to the CI run.",
  ],
];

const STORES: [Icon, string, string][] = [
  [
    DatabaseIcon,
    "Stores each image once",
    "Per account, keyed by its SHA-256 hash.",
  ],
  [
    LockSimpleIcon,
    "Signs private image links",
    "They expire after one to two hours.",
  ],
  [
    GithubLogoIcon,
    "Follows GitHub access",
    "Private builds show only to people who can read the repository.",
  ],
  [
    ShieldCheckIcon,
    "Sets the check",
    "The commit status links to the review page.",
  ],
];

function FlowBox({
  title,
  caption,
  items,
}: {
  title: string;
  caption: string;
  items: [Icon, string, string][];
}) {
  return (
    <div className="rounded-xl bg-card border shadow-xs/5">
      <div
        className={`flex h-10 items-center justify-between border-b ${DOTTED} px-4`}
      >
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{caption}</span>
      </div>
      <ul className="flex flex-col gap-4 p-4">
        {items.map(([ItemIcon, label, text]) => (
          <li key={label} className="flex gap-3">
            <ItemIcon
              size={16}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Connector() {
  return (
    <div
      aria-hidden
      className="flex items-center text-muted-foreground/64 lg:mt-3.5 max-lg:mx-auto max-lg:h-10 max-lg:flex-col"
    >
      <span className="h-px flex-1 border-t border-dashed border-current max-lg:h-auto max-lg:w-0 max-lg:border-t-0 max-lg:border-l" />
      <CaretRightIcon size={12} weight="bold" className="-ml-1 max-lg:hidden" />
      <CaretDownIcon size={12} weight="bold" className="-mt-1 lg:hidden" />
    </div>
  );
}

function Manifest() {
  const [open, setOpen] = useState<string | null>(SENT[0]?.[1] ?? null);
  return (
    <div className="self-start rounded-xl border bg-muted/72">
      <div
        className={`flex h-10 items-center justify-between gap-3 border-b ${DOTTED} px-4`}
      >
        <span className="mono text-sm">npx stateofpixel upload</span>
        <span className="text-xs text-muted-foreground">Sends</span>
      </div>
      <Accordion
        value={open === null ? [] : [open]}
        onValueChange={(next) => {
          const label = (next as string[])[0] ?? null;
          if (label !== null) {
            track("Upload manifest", { item: label });
          }
          setOpen(label);
        }}
        className="p-1"
      >
        {SENT.map(([ItemIcon, label, example, detail]) => (
          <AccordionItem key={label} value={label} className="border-b-0">
            <AccordionTrigger className="h-10 items-center rounded-md px-3 py-0 transition-colors duration-100 hover:bg-accent">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <ItemIcon
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span>{label}</span>
                <span className="mono ml-auto truncate font-normal text-muted-foreground max-sm:hidden">
                  {example}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionPanel className="pt-1 pr-3 pb-3 pl-10 text-xs">
              {detail}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function FlowFact({
  icon: FactIcon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex gap-3 border-t ${DOTTED} py-5`}>
      <FactIcon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {children}
        </span>
      </span>
    </div>
  );
}

export function TrustSection() {
  const security = findDoc("security")?.meta;
  return (
    <section id="faq" className={`${MUTED_BAND} scroll-mt-16`}>
      <div className={SECTION}>
        <LeadCopy title="What leaves your CI." className="max-w-[760px]">
          {security?.lead}
        </LeadCopy>
        <div className="mt-12 grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1.2fr)_40px_minmax(0,1fr)] items-start max-lg:grid-cols-1">
          <FlowBox title="Your CI" caption="Stays here" items={STAYS} />
          <Connector />
          <Manifest />
          <Connector />
          <FlowBox title="stateofpixel" caption="Does with it" items={STORES} />
        </div>
        <div className="mt-16 grid grid-cols-[1fr_2fr] gap-12 max-lg:grid-cols-1">
          <div>
            <div className="flex h-8 items-center">
              <ListTitle>Outages and billing</ListTitle>
            </div>
            <div className="mt-4">
              <FlowFact icon={CloudSlashIcon} title="Outages">
                {ANSWERS.get("What happens when stateofpixel is down?")}
              </FlowFact>
              <FlowFact icon={ReceiptIcon} title="Billing">
                Plans are fixed, with no overage. {facts.graceDays} days after
                the storage limit, new images are not stored and the check
                passes with a note.
              </FlowFact>
            </div>
            <div
              className={`flex flex-wrap gap-x-6 gap-y-2 border-t ${DOTTED} pt-5`}
            >
              <DocLink slug="security">Security docs</DocLink>
              <DocLink slug="billing">Billing docs</DocLink>
            </div>
            <div className="mt-8 flex flex-col items-start gap-3 rounded-lg bg-card p-4 border shadow-xs/5">
              <p>
                <span className="block text-sm font-medium">
                  Talk to Vaibhav
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  A 30 minute call, for anything this page does not answer.
                </span>
              </p>
              <Button
                variant="outline"
                render={
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener"
                    data-umami-event="Book a call"
                  />
                }
              >
                Book a call
              </Button>
            </div>
          </div>
          <FaqAccordion
            title="Other questions"
            questions={QUESTIONS.map(([question]) => question)}
          />
        </div>
      </div>
    </section>
  );
}
