import {
  ArrowDownIcon,
  ArrowRightIcon,
  CaretDownIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  type Cell,
  CHECKED,
  COMPETITORS,
  type Competitor,
  OURS,
  ROW_GROUPS,
  type RowKey,
  type Source,
} from "../../content/compare";
import argosAfter from "../../snippets/compare/argos-after.yml?highlight";
import argosBefore from "../../snippets/compare/argos-before.yml?highlight";
import chromaticAfter from "../../snippets/compare/chromatic-after.yml?highlight";
import chromaticBefore from "../../snippets/compare/chromatic-before.yml?highlight";
import lostPixelAfter from "../../snippets/compare/lost-pixel-after.yml?highlight";
import lostPixelBefore from "../../snippets/compare/lost-pixel-before.yml?highlight";
import percyAfter from "../../snippets/compare/percy-after.yml?highlight";
import percyBefore from "../../snippets/compare/percy-before.yml?highlight";
import playwrightConfig from "../../snippets/playwright.config.ts?highlight";
import { CodeBlock, type Snippet } from "../CodeBlock";
import { formatPrice } from "../landing/Pricing";
import { DISPLAY, LEAD, PublicPage, SECTION, WIDE } from "../landing/sections";
import { AuthButton } from "../SignIn";
import { buttonClass, LeadCopy, Logo } from "../ui";
import {
  BillLogo,
  CostCalculator,
  DEFAULT_SUITE,
  quote,
} from "./CostCalculator";

const DOTTED = "border-dotted border-field-border/50";
const WORKFLOW = ".github/workflows/visual.yml";
const CARD_SHADOW = "shadow-[0_8px_32px_#11151a18,0_1px_4px_#11151a0a]";

const SWITCH_SNIPPETS: Record<
  Competitor["slug"],
  { before: Snippet; after: { file: string; snippet: Snippet }[] }
> = {
  chromatic: {
    before: chromaticBefore,
    after: [{ file: WORKFLOW, snippet: chromaticAfter }],
  },
  argos: {
    before: argosBefore,
    after: [{ file: WORKFLOW, snippet: argosAfter }],
  },
  percy: {
    before: percyBefore,
    after: [
      { file: WORKFLOW, snippet: percyAfter },
      { file: "playwright.config.ts", snippet: playwrightConfig },
    ],
  },
  "lost-pixel": {
    before: lostPixelBefore,
    after: [{ file: WORKFLOW, snippet: lostPixelAfter }],
  },
};

export const OUR_FLOW = [
  "Your tests take screenshots",
  "The CLI hashes and compares them on the runner",
  "Only images we have not seen upload",
  "The review page and the GitHub check",
];

const ROW_KEYS = ROW_GROUPS.flatMap(
  (group) => Object.keys(group.rows) as RowKey[],
);

function pageSources(competitor: Competitor): Source[] {
  const sources = new Map<string, Source>();
  for (const item of competitor.status ?? []) {
    sources.set(item.source.url, item.source);
  }
  for (const key of ROW_KEYS) {
    for (const source of competitor.cells[key]?.sources ?? []) {
      sources.set(source.url, source);
    }
  }
  return [...sources.values()];
}

function SourceMarks({
  items,
  sources,
}: {
  items: Source[];
  sources: Source[];
}) {
  const numbers = items
    .map((source) => sources.findIndex((item) => item.url === source.url) + 1)
    .sort((a, b) => a - b);
  return numbers.map((number) => (
    <sup key={number} className="ml-0.5 text-2xs">
      <a
        href={`#source-${number}`}
        aria-label={`Source ${number}: ${sources[number - 1]?.label}`}
        className="text-link"
      >
        {number}
      </a>
    </sup>
  ));
}

export function CompetitorLogo({
  competitor,
  size,
}: {
  competitor: Competitor;
  size: number;
}) {
  return (
    <img
      src={competitor.logo}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="flex-none rounded-[22%] ring-1 ring-border"
    />
  );
}

function Lockup({ competitor }: { competitor: Competitor }) {
  return (
    <p className="flex items-center gap-3 text-sm text-muted">
      <span className="text-text">
        <Logo size={32} />
      </span>
      <span className="mono text-xs">vs</span>
      <CompetitorLogo competitor={competitor} size={32} />
      <span className="ml-1">
        <Link to="/compare" className="hover:text-text">
          Compare
        </Link>{" "}
        / {competitor.name}
      </span>
    </p>
  );
}

function BillCard({ competitor }: { competitor: Competitor }) {
  if (competitor.priced === null) {
    return null;
  }
  const { snapshots, bills } = quote(DEFAULT_SUITE, [competitor.priced]);
  return (
    <div
      className={`w-[480px] overflow-hidden rounded-lg bg-surface ring-1 ring-border max-lg:w-full ${CARD_SHADOW}`}
    >
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold">A month of visual tests</p>
        <p className="text-xs text-muted">
          {DEFAULT_SUITE.screens} stories, {DEFAULT_SUITE.viewports} viewports,{" "}
          {DEFAULT_SUITE.builds} builds, {snapshots.toLocaleString("en-US")}{" "}
          screenshots
        </p>
      </div>
      <ul className="divide-y divide-border">
        {bills.map((bill, index) => (
          <li key={bill.name} className="flex items-center gap-3 px-5 py-4">
            <BillLogo bill={bill} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{bill.name}</span>
              <span className="block text-xs text-muted">{bill.plan}</span>
            </span>
            <span
              className={`tabular-nums ${index === 0 ? "text-[36px] leading-none font-semibold tracking-[-0.04em] text-approved" : "text-2xl font-medium text-muted"}`}
            >
              ${Math.round(bill.cost ?? 0).toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
      <a
        href="#cost"
        className="flex items-center gap-2 border-t border-border bg-bg px-5 py-3 text-xs text-muted hover:text-text"
      >
        Price it for your suite
        <ArrowDownIcon size={12} />
      </a>
    </div>
  );
}

function StatusCard({
  competitor,
  sources,
}: {
  competitor: Competitor;
  sources: Source[];
}) {
  if (competitor.status === undefined) {
    return null;
  }
  return (
    <div
      className={`w-[480px] overflow-hidden rounded-lg bg-surface ring-1 ring-border max-lg:w-full ${CARD_SHADOW}`}
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <CompetitorLogo competitor={competitor} size={28} />
        <span className="flex-1 text-sm font-semibold">{competitor.name}</span>
        <span className="rounded-full bg-rejected-bg px-2 py-0.5 text-xs font-medium text-rejected">
          Shutting down
        </span>
      </div>
      <dl className="divide-y divide-border">
        {competitor.status.map((item) => (
          <div key={item.label} className="flex gap-4 px-5 py-4 text-sm">
            <dt className="w-28 shrink-0 text-muted">{item.label}</dt>
            <dd className="font-medium">
              {item.value}
              <SourceMarks items={[item.source]} sources={sources} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HeroTitle({ competitor }: { competitor: Competitor }) {
  if (competitor.priced === null) {
    return (
      <h1 className={`${DISPLAY} mt-8 max-w-[16ch]`}>{competitor.headline}</h1>
    );
  }
  const { snapshots, bills } = quote(DEFAULT_SUITE, [competitor.priced]);
  const [ours, theirs] = bills;
  const saved = ((theirs?.cost ?? 0) - (ours?.cost ?? 0)) * 12;
  return (
    <>
      <h1 className={`${DISPLAY} mt-8 max-w-[18ch]`}>
        <span className="block text-[clamp(56px,7vw,112px)] leading-none tracking-[-0.05em] text-approved tabular-nums">
          {formatPrice(Math.round(saved))}
        </span>
        a year less than {competitor.name}.
      </h1>
      <p className="mt-4 text-sm text-muted">
        For {DEFAULT_SUITE.screens} stories at {DEFAULT_SUITE.viewports}{" "}
        viewports and {DEFAULT_SUITE.builds} builds a month,{" "}
        {snapshots.toLocaleString("en-US")} screenshots.
      </p>
    </>
  );
}

function CompareHero({
  competitor,
  sources,
}: {
  competitor: Competitor;
  sources: Source[];
}) {
  return (
    <section
      className={`${WIDE} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-12 pt-24 pb-16 max-lg:grid-cols-1 max-sm:pt-12`}
    >
      <div>
        <Lockup competitor={competitor} />
        <HeroTitle competitor={competitor} />
        <p className={`${LEAD} mt-6 max-w-[640px]`}>{competitor.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AuthButton label="Start free with GitHub" />
          <a href="#switch" className={buttonClass("secondary")}>
            See the switch
            <ArrowDownIcon size={14} className="text-muted" />
          </a>
        </div>
        <p className="mt-4 text-xs text-muted">
          Facts about {competitor.name} checked on {CHECKED}, with{" "}
          <a href="#sources" className="text-link">
            {sources.length} sources
          </a>
          .
        </p>
      </div>
      <BillCard competitor={competitor} />
      <StatusCard competitor={competitor} sources={sources} />
    </section>
  );
}

function FlowLane({
  title,
  icon,
  steps,
  bill,
  ours,
}: {
  title: string;
  icon: ReactNode;
  steps: string[];
  bill: string;
  ours: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-6 max-sm:p-4 ${ours ? "bg-surface ring-1 ring-border" : "bg-surface-2"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {icon}
        <span className="text-base font-semibold">{title}</span>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${ours ? "bg-approved-bg text-approved" : "bg-changed-bg text-changed"}`}
        >
          {bill}
        </span>
      </div>
      <ol className="mt-6 grid grid-cols-4 gap-3 max-md:grid-cols-1">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col gap-3 max-md:flex-row">
            <span className="flex items-center gap-2">
              <span
                className={`mono flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${ours ? "bg-approved text-surface" : "bg-surface text-muted ring-1 ring-border"}`}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px flex-1 max-md:hidden ${ours ? "bg-approved/40" : "bg-field-border/60"}`}
                />
              )}
            </span>
            <span className="text-sm">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FlowSection({ competitor }: { competitor: Competitor }) {
  return (
    <section className={SECTION}>
      <LeadCopy
        title="Where the screenshots come from."
        className="max-w-[720px]"
      >
        That one choice decides what can drift, and what you are billed for.
      </LeadCopy>
      <div className="mt-12 flex flex-col gap-3">
        <FlowLane
          title={competitor.name}
          icon={<CompetitorLogo competitor={competitor} size={24} />}
          steps={competitor.theirFlow}
          bill={competitor.theirBill}
          ours={false}
        />
        <FlowLane
          title="stateofpixel"
          icon={<Logo size={24} />}
          steps={OUR_FLOW}
          bill="Billed per GB stored"
          ours
        />
      </div>
    </section>
  );
}

function Differences({ competitor }: { competitor: Competitor }) {
  return (
    <section className={SECTION}>
      <LeadCopy title="What changes when you switch." className="max-w-[720px]">
        The same pull request, reviewed with less in the way.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        {competitor.differences.map(([title, text], index) => (
          <div
            key={title}
            className="flex flex-col rounded-lg bg-surface p-6 ring-1 ring-border"
          >
            <span className="mono text-xs text-muted tabular-nums">
              0{index + 1}
            </span>
            <span className="mt-8 text-xl font-semibold tracking-[-0.025em] text-balance">
              {title}
            </span>
            <span className="mt-3 text-sm text-muted">{text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const REVIEW_POINTS: [string, string][] = [
  ["Four views", "Side by side, diff, slider and flip."],
  ["Keyboard first", "j and k to move, a to approve, r to reject."],
  ["One check", "Green when every change is approved."],
];

function ProductShot() {
  return (
    <section className={SECTION}>
      <div className="grid grid-cols-[1fr_2fr] items-center gap-12 max-lg:grid-cols-1">
        <div>
          <LeadCopy title="What your reviewers get." className="max-w-[420px]">
            Each changed screenshot next to its baseline, with the changed
            pixels in green.
          </LeadCopy>
          <ul className={`mt-8 border-t ${DOTTED} text-sm`}>
            {REVIEW_POINTS.map(([title, text]) => (
              <li key={title} className={`border-b ${DOTTED} py-3`}>
                <span className="font-medium">{title}.</span>
                <span className="text-muted"> {text}</span>
              </li>
            ))}
          </ul>
          <a href="/#demo" className={`${buttonClass("secondary")} mt-8`}>
            Try the review page
            <ArrowRightIcon size={14} className="text-muted" />
          </a>
        </div>
        <div className="checker rounded-xl p-8 ring-1 ring-border max-md:p-3">
          <img
            src="/readme/review-page.png"
            alt="The stateofpixel review page, with the baseline and the new screenshot side by side and the changed pixels in green"
            width={1440}
            height={760}
            loading="lazy"
            className={`w-full rounded-lg ring-1 ring-border ${CARD_SHADOW}`}
          />
        </div>
      </div>
    </section>
  );
}

function GlanceTable({
  competitor,
  sources,
}: {
  competitor: Competitor;
  sources: Source[];
}) {
  const columns =
    "grid grid-cols-[minmax(0,220px)_1fr_1fr] gap-x-8 max-md:grid-cols-2 max-md:gap-x-4";
  return (
    <section className={SECTION}>
      <LeadCopy title="Side by side." className="max-w-[720px]">
        Every row about {competitor.name} links to the page it came from.
      </LeadCopy>
      <div className="mt-12 text-sm">
        <div
          className={`${columns} sticky top-16 z-[1] border-b border-border bg-surface py-4`}
        >
          <span className="max-md:hidden" />
          <span className="flex items-center gap-2 font-semibold">
            <Logo size={20} />
            stateofpixel
          </span>
          <span className="flex items-center gap-2 font-semibold">
            <CompetitorLogo competitor={competitor} size={20} />
            {competitor.name}
          </span>
        </div>
        {ROW_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="pt-10 pb-2 text-xs font-medium text-muted">
              {group.title}
            </p>
            {(Object.entries(group.rows) as [RowKey, string][]).map(
              ([key, label]) => {
                const cell: Cell | undefined = competitor.cells[key];
                return (
                  <div
                    key={key}
                    className={`${columns} gap-y-2 border-t ${DOTTED} py-4`}
                  >
                    <span className="text-muted max-md:col-span-2">
                      {label}
                    </span>
                    <span className="font-medium">{OURS[key]}</span>
                    <span>
                      {cell === undefined ? (
                        <span className="text-muted">
                          Not found in their docs.
                        </span>
                      ) : (
                        <>
                          {cell.text}
                          <SourceMarks items={cell.sources} sources={sources} />
                        </>
                      )}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Ahead({ competitor }: { competitor: Competitor }) {
  return (
    <section className={SECTION}>
      <LeadCopy
        title={`Where ${competitor.name} is ahead.`}
        className="max-w-[720px]"
      >
        We skip some features on purpose. If you need one of these, choose{" "}
        {competitor.name}.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {competitor.ahead.map(([title, text]) => (
          <div key={title} className="flex gap-4 rounded-lg bg-surface-2 p-6">
            <CompetitorLogo competitor={competitor} size={24} />
            <span>
              <span className="block text-base font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Switch({ competitor }: { competitor: Competitor }) {
  const snippets = SWITCH_SNIPPETS[competitor.slug];
  return (
    <section id="switch" className={`${SECTION} scroll-mt-16`}>
      <LeadCopy title="Switch in one pull request." className="max-w-[720px]">
        Keep your tests. Change the step that sends screenshots to{" "}
        {competitor.name}. The{" "}
        <Link
          to="/docs/$slug"
          params={{ slug: "moving" }}
          className="text-link"
        >
          moving guide
        </Link>{" "}
        has the details.
      </LeadCopy>
      <ol className="mt-12 grid grid-cols-3 gap-8 max-md:grid-cols-1 max-md:gap-4">
        {competitor.switchSteps.map(([title, text], index) => (
          <li key={title} className={`flex gap-4 border-t ${DOTTED} pt-5`}>
            <span className="mono text-muted tabular-nums">{index + 1}</span>
            <span>
              <span className="block text-base font-medium">{title}</span>
              <span className="mt-1 block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted">
            <CompetitorLogo competitor={competitor} size={16} />
            Before
          </p>
          <CodeBlock fileName={WORKFLOW} {...snippets.before} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted">
            <span className="text-text">
              <Logo size={16} />
            </span>
            After
          </p>
          {snippets.after.map((block) => (
            <CodeBlock
              key={block.file}
              fileName={block.file}
              {...block.snippet}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq({ competitor }: { competitor: Competitor }) {
  return (
    <section
      className={`${SECTION} grid grid-cols-[1fr_2fr] gap-12 max-lg:grid-cols-1`}
    >
      <LeadCopy title="Questions." className="max-w-[360px]">
        What to know before you move from {competitor.name}.
      </LeadCopy>
      <div className={`border-t ${DOTTED}`}>
        {competitor.faq.map(([question, answer]) => (
          <details key={question} className={`group border-b ${DOTTED}`}>
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

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <section id="sources" className={`${WIDE} scroll-mt-16 pb-24 max-sm:pb-12`}>
      <p className="text-sm font-semibold">Sources</p>
      <p className="mt-1 text-xs text-muted">
        Read on {CHECKED}. Prices are list prices before tax. The stateofpixel
        column comes from{" "}
        <Link to="/docs" className="text-link">
          our docs
        </Link>
        .
      </p>
      <ol className="mt-4 grid grid-cols-3 gap-x-8 text-xs max-lg:grid-cols-2 max-sm:grid-cols-1">
        {sources.map((source, index) => (
          <li
            key={source.url}
            id={`source-${index + 1}`}
            className={`flex scroll-mt-20 gap-3 border-b ${DOTTED} py-2`}
          >
            <span className="mono w-5 shrink-0 text-muted tabular-nums">
              {index + 1}
            </span>
            <a href={source.url} className="min-w-0 truncate text-link">
              {source.label}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FinalBand({ current }: { current?: Competitor }) {
  const others = COMPETITORS.filter(
    (competitor) => competitor.slug !== current?.slug,
  );
  return (
    <section className="border-t border-border bg-bg">
      <div
        className={`${SECTION} grid grid-cols-2 items-end gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <h2 className={DISPLAY}>
            Every pixel, reviewed.
            <br />
            <span className="text-muted">Nothing ships by surprise.</span>
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <AuthButton label="Start free with GitHub" />
            <Link to="/docs" className={buttonClass("ghost")}>
              Read the quickstart
            </Link>
          </div>
        </div>
        {current !== undefined && (
          <nav aria-label="Other comparisons">
            <p className="text-xs font-medium text-muted">Other comparisons</p>
            <ul className={`mt-3 border-t ${DOTTED}`}>
              {others.map((competitor) => (
                <li key={competitor.slug}>
                  <Link
                    to="/compare/$slug"
                    params={{ slug: competitor.slug }}
                    className={`group flex items-center gap-3 border-b ${DOTTED} py-3`}
                  >
                    <CompetitorLogo competitor={competitor} size={24} />
                    <span className="flex-1 text-base font-medium">
                      vs {competitor.name}
                    </span>
                    <ArrowRightIcon
                      size={14}
                      className="text-muted transition-transform duration-100 group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}

export function ComparePage({ competitor }: { competitor: Competitor }) {
  const sources = pageSources(competitor);
  return (
    <PublicPage>
      <CompareHero competitor={competitor} sources={sources} />
      <FlowSection competitor={competitor} />
      <Differences competitor={competitor} />
      <ProductShot />
      {competitor.priced !== null && (
        <CostCalculator competitors={[competitor.priced]} />
      )}
      <GlanceTable competitor={competitor} sources={sources} />
      <Ahead competitor={competitor} />
      <Switch competitor={competitor} />
      <Faq competitor={competitor} />
      <SourceList sources={sources} />
      <FinalBand current={competitor} />
    </PublicPage>
  );
}

export function faqJsonLd(competitor: Competitor) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: competitor.faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });
}
