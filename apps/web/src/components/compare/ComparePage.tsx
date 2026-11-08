import {
  ArrowDownIcon,
  ArrowRightIcon,
  CaretDownIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { type CSSProperties, Fragment, type ReactNode, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardFrame,
  CardFrameAction,
  CardFrameHeader,
  CardFrameTitle,
  cn,
  RadioGroupPrimitive,
  RadioPrimitive,
  SegmentedControl,
  SegmentedControlItem,
} from "uiofcraft";
import {
  CHECKED,
  COMPETITORS,
  type Competitor,
  OURS,
  ROW_GROUPS,
  type RowKey,
  type Source,
} from "../../content/compare";
import applitoolsAfter from "../../snippets/compare/applitools-after.yml?highlight";
import applitoolsBefore from "../../snippets/compare/applitools-before.yml?highlight";
import argosAfter from "../../snippets/compare/argos-after.yml?highlight";
import argosBefore from "../../snippets/compare/argos-before.yml?highlight";
import backstopjsAfter from "../../snippets/compare/backstopjs-after.yml?highlight";
import backstopjsBefore from "../../snippets/compare/backstopjs-before.yml?highlight";
import chromaticAfter from "../../snippets/compare/chromatic-after.yml?highlight";
import chromaticBefore from "../../snippets/compare/chromatic-before.yml?highlight";
import happoAfter from "../../snippets/compare/happo-after.yml?highlight";
import happoBefore from "../../snippets/compare/happo-before.yml?highlight";
import lostPixelAfter from "../../snippets/compare/lost-pixel-after.yml?highlight";
import lostPixelBefore from "../../snippets/compare/lost-pixel-before.yml?highlight";
import percyAfter from "../../snippets/compare/percy-after.yml?highlight";
import percyBefore from "../../snippets/compare/percy-before.yml?highlight";
import playwrightConfig from "../../snippets/playwright.config.ts?highlight";
import { CodeBlock, type Snippet } from "../CodeBlock";
import { DEFAULT_WORKLOAD, formatPrice } from "../landing/Pricing";
import {
  DISPLAY,
  LEAD,
  MUTED_BAND,
  PublicPage,
  SECTION,
  WIDE,
} from "../landing/sections";
import { AuthButton } from "../SignIn";
import { LeadCopy, Logo } from "../ui";
import {
  BillLogo,
  CostCalculator,
  DEFAULT_SUITE,
  quote,
} from "./CostCalculator";

const DOTTED = "border-border";
const count = new Intl.NumberFormat("en-US");
const WORKFLOW = ".github/workflows/visual.yml";
const CARD_SHADOW =
  "shadow-[0_32px_64px_-32px] shadow-black/24 dark:shadow-black/64";

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
  applitools: {
    before: applitoolsBefore,
    after: [{ file: WORKFLOW, snippet: applitoolsAfter }],
  },
  happo: {
    before: happoBefore,
    after: [{ file: WORKFLOW, snippet: happoAfter }],
  },
  backstopjs: {
    before: backstopjsBefore,
    after: [
      { file: WORKFLOW, snippet: backstopjsAfter },
      { file: "playwright.config.ts", snippet: playwrightConfig },
    ],
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
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <span className="flex items-center -space-x-1.5">
        <span className="rounded-[9px] bg-background text-foreground ring-2 ring-background">
          <Logo size={32} />
        </span>
        <span className="rounded-[9px] ring-2 ring-background">
          <CompetitorLogo competitor={competitor} size={32} />
        </span>
      </span>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/compare" />}>
              Compare
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>vs {competitor.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

function BillCard({ competitor }: { competitor: Competitor }) {
  if (competitor.priced === null) {
    return null;
  }
  const { snapshots, bills } = quote(DEFAULT_SUITE, [competitor.priced]);
  return (
    <div
      className={`w-[480px] max-w-full overflow-hidden rounded-2xl border bg-card max-lg:w-full ${CARD_SHADOW}`}
    >
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold">A month of visual tests</p>
        <p className="text-xs text-muted-foreground">
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
              <span className="block text-xs text-muted-foreground">
                {bill.plan}
              </span>
            </span>
            <span
              className={`tabular-nums ${index === 0 ? "text-[36px] leading-none font-semibold tracking-[-0.04em] text-approved" : "text-2xl font-medium text-muted-foreground"}`}
            >
              ${Math.round(bill.cost ?? 0).toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
      <a
        href="#cost"
        className="flex items-center gap-2 border-t border-border bg-background px-5 py-3 text-xs text-muted-foreground hover:text-foreground"
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
      className={`w-[480px] max-w-full overflow-hidden rounded-2xl border bg-card max-lg:w-full ${CARD_SHADOW}`}
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <CompetitorLogo competitor={competitor} size={28} />
        <span className="flex-1 text-sm font-semibold">{competitor.name}</span>
        <Badge variant="error">Shutting down</Badge>
      </div>
      <dl className="divide-y divide-border">
        {competitor.status.map((item) => (
          <div key={item.label} className="flex gap-4 px-5 py-4 text-sm">
            <dt className="w-28 shrink-0 text-muted-foreground">
              {item.label}
            </dt>
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
      <p className="mt-4 text-sm text-muted-foreground">
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
      className={`${WIDE} grid items-center gap-10 pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-10`}
    >
      <div className="lg:col-span-7">
        <Lockup competitor={competitor} />
        <HeroTitle competitor={competitor} />
        <p className={`${LEAD} mt-6 max-w-[640px]`}>{competitor.lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AuthButton label="Start free with GitHub" />
          <Button variant="outline" render={<a href="#switch" />}>
            See the switch
            <ArrowDownIcon size={14} className="text-muted-foreground" />
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Facts about {competitor.name} checked on {CHECKED}, with{" "}
          <a href="#sources" className="text-link">
            {sources.length} sources
          </a>
          .
        </p>
      </div>
      <div className="lg:col-span-5 lg:justify-self-end">
        <BillCard competitor={competitor} />
        <StatusCard competitor={competitor} sources={sources} />
      </div>
    </section>
  );
}

type Period = "build" | "month";

const PERIODS: { value: Period; label: string }[] = [
  { value: "build", label: "One build" },
  { value: "month", label: "One month" },
];

function FlowSection({ competitor }: { competitor: Competitor }) {
  const [period, setPeriod] = useState<Period>("build");
  const builds = period === "build" ? 1 : DEFAULT_SUITE.builds;
  const { screenshots, changed } = perBuild();
  const [ours, theirs] = quote(
    DEFAULT_SUITE,
    competitor.priced === null ? [] : [competitor.priced],
  ).bills;
  const metrics = [
    `${count.format(screenshots * builds)} screenshots`,
    `${count.format(screenshots * builds)} hashes`,
    `${count.format(changed * builds)} changed`,
  ];
  return (
    <section className={SECTION}>
      <LeadCopy title="One build, step by step." className="max-w-[720px]">
        {DEFAULT_SUITE.screens} stories at {DEFAULT_SUITE.viewports} viewports,
        run through {competitor.name} and through stateofpixel.
      </LeadCopy>
      <CardFrame className="mt-12">
        <CardFrameHeader className="py-3">
          <CardFrameTitle>
            {period === "build"
              ? "One build"
              : `One month, ${count.format(builds)} builds`}
          </CardFrameTitle>
          <CardFrameAction>
            <Segmented
              label="Count for"
              event="Compare period"
              options={PERIODS}
              value={period}
              onChange={setPeriod}
            />
          </CardFrameAction>
        </CardFrameHeader>
        <Card className="divide-y overflow-hidden">
          <Lane
            name={competitor.name}
            logo={<CompetitorLogo competitor={competitor} size={28} />}
            steps={competitor.theirFlow.map((step) => ({ text: step }))}
            total={{
              ours: false,
              label: competitor.theirBill,
              value: count.format(screenshots * builds),
              note:
                period === "month" && theirs?.cost != null
                  ? `${formatPrice(theirs.cost)} a month on ${theirs.plan}`
                  : "Each screenshot in each build",
            }}
          />
          <Lane
            name="stateofpixel"
            logo={<Logo size={28} />}
            steps={OUR_FLOW.map((step, index) => ({
              text: step,
              metric: metrics[index],
            }))}
            total={{
              ours: true,
              label: "Billed per GB stored",
              value: "0",
              note:
                period === "month" && ours?.cost != null
                  ? `${formatPrice(ours.cost)} a month on ${ours.plan}`
                  : `${count.format(changed)} changed screenshots and their diffs stored`,
            }}
          />
        </Card>
      </CardFrame>
    </section>
  );
}

function Lane({
  name,
  logo,
  steps,
  total,
}: {
  name: string;
  logo: ReactNode;
  steps: { text: string; metric?: string }[];
  total: { ours: boolean; label: string; value: string; note: string };
}) {
  return (
    <div
      className={cn(
        "grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8",
        !total.ours && "bg-muted/40",
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2.5 font-medium text-sm">
          <span className="text-foreground">{logo}</span>
          {name}
        </p>
        <ol className="mt-5 grid gap-4 md:grid-cols-4 md:gap-3">
          {steps.map((step, index) => (
            <li
              key={step.text}
              className="relative flex gap-3 md:flex-col md:gap-3"
            >
              <span className="flex items-center md:w-full">
                <span className="mono relative z-1 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground text-xs tabular-nums">
                  {index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="ml-2 h-px flex-1 bg-border max-md:hidden"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm">{step.text}</span>
                {step.metric !== undefined && (
                  <span
                    key={step.metric}
                    className="mono w-fit animate-fade rounded-xs bg-muted px-1.5 py-0.5 text-muted-foreground text-xs tabular-nums"
                  >
                    {step.metric}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div
        className={cn(
          "flex flex-col gap-1 rounded-xl border p-4 lg:self-stretch",
          total.ours ? "bg-approved-bg/60" : "bg-card",
        )}
      >
        <Badge
          variant="secondary"
          className={cn(
            "w-fit",
            total.ours
              ? "bg-approved-bg text-approved"
              : "bg-changed-bg text-changed",
          )}
        >
          {total.label}
        </Badge>
        <span className="mt-auto flex items-baseline gap-2 pt-3">
          <span
            key={total.value}
            className={cn(
              "animate-fade font-heading font-semibold text-4xl leading-none tracking-[-0.02em] tabular-nums",
              total.ours && "text-approved",
            )}
          >
            {total.value}
          </span>
          <span className="text-muted-foreground text-sm">counted</span>
        </span>
        <span className="text-muted-foreground text-sm">{total.note}</span>
      </div>
    </div>
  );
}

function Segmented<Value extends string>({
  label,
  event,
  options,
  value,
  onChange,
}: {
  label: string;
  event: string;
  options: { value: Value; label: string; count?: number }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <SegmentedControl
      aria-label={label}
      className="max-w-full flex-wrap"
      render={
        <RadioGroupPrimitive
          value={value}
          onValueChange={(next) => onChange(next as Value)}
        />
      }
    >
      {options.map((option) => (
        <SegmentedControlItem
          key={option.value}
          render={
            <RadioPrimitive.Root
              value={option.value}
              data-umami-event={event}
              data-umami-event-value={option.value}
            />
          }
        >
          {option.label}
          {option.count !== undefined && (
            <span className="mono text-muted-foreground tabular-nums">
              {option.count}
            </span>
          )}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function perBuild() {
  const screenshots =
    DEFAULT_SUITE.screens * DEFAULT_SUITE.viewports * DEFAULT_SUITE.browsers;
  return {
    screenshots,
    changed: Math.round((screenshots * DEFAULT_WORKLOAD.changed) / 100),
  };
}

function Differences({ competitor }: { competitor: Competitor }) {
  return (
    <section className={MUTED_BAND}>
      <div className={SECTION}>
        <LeadCopy
          title="What changes when you switch."
          className="max-w-[720px]"
        >
          The same pull request, reviewed with less in the way.
        </LeadCopy>
        <div className="mt-12 grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          {competitor.differences.map(([title, text], index) => (
            <div
              key={title}
              className="flex flex-col rounded-2xl border bg-card p-6 shadow-xs/5"
            >
              <span className="mono text-xs text-muted-foreground tabular-nums">
                0{index + 1}
              </span>
              <span className="mt-8 text-balance font-heading font-semibold text-xl tracking-[-0.01em]">
                {title}
              </span>
              <span className="mt-3 text-sm text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
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
            pixels in magenta.
          </LeadCopy>
          <ul className={`mt-8 border-t ${DOTTED} text-sm`}>
            {REVIEW_POINTS.map(([title, text]) => (
              <li key={title} className={`border-b ${DOTTED} py-3`}>
                <span className="font-medium">{title}.</span>
                <span className="text-muted-foreground"> {text}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            className="mt-8"
            render={<a href="/#demo" />}
          >
            Try the review page
            <ArrowRightIcon size={14} className="text-muted-foreground" />
          </Button>
        </div>
        <div className="checker rounded-2xl border p-8 max-md:p-3">
          <img
            src="/readme/review-page.png"
            alt="The stateofpixel review page, with the baseline and the new screenshot side by side and the changed pixels in magenta"
            width={1440}
            height={760}
            loading="lazy"
            className={`w-full rounded-lg border ${CARD_SHADOW}`}
          />
        </div>
      </div>
    </section>
  );
}

const KEY_ROWS: RowKey[] = ["billing", "free", "limit", "renders", "compares"];

const LABELS = Object.fromEntries(
  ROW_GROUPS.flatMap((group) => Object.entries(group.rows)),
) as Record<RowKey, string>;

type View = "key" | (typeof ROW_GROUPS)[number]["title"] | "all";

const VIEWS: { value: View; label: string; keys: RowKey[] }[] = [
  { value: "key", label: "Key rows", keys: KEY_ROWS },
  ...ROW_GROUPS.map((group) => ({
    value: group.title,
    label: group.title,
    keys: Object.keys(group.rows) as RowKey[],
  })),
  { value: "all", label: "All", keys: ROW_KEYS },
];

const COLUMNS =
  "relative grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-sm max-md:grid-cols-1";

function GlanceTable({
  competitor,
  sources,
}: {
  competitor: Competitor;
  sources: Source[];
}) {
  const [view, setView] = useState<View>("key");
  const keys = VIEWS.find((item) => item.value === view)?.keys ?? KEY_ROWS;
  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <LeadCopy
          title={`stateofpixel and ${competitor.name}, row by row.`}
          className="max-w-[640px]"
        >
          Every row about {competitor.name} links to the page it came from.
        </LeadCopy>
        <Segmented
          label="Rows"
          event="Compare rows"
          options={VIEWS.map((item) => ({
            value: item.value,
            label: item.label,
            count: item.keys.length,
          }))}
          value={view}
          onChange={setView}
        />
      </div>
      <div
        className={`${COLUMNS} mt-12 max-md:mt-4`}
        style={
          {
            gridTemplateRows: `repeat(${keys.length + 1}, auto)`,
          } as CSSProperties
        }
      >
        <div
          aria-hidden
          className="col-start-2 row-span-full row-start-1 rounded-2xl border bg-card shadow-xs/5 max-md:hidden"
        />
        <div
          aria-hidden
          className="col-start-3 row-span-full row-start-1 rounded-2xl bg-muted/72 max-md:hidden"
        />
        <ColumnHead column="md:col-start-2">
          <Logo size={24} />
          stateofpixel
        </ColumnHead>
        <ColumnHead column="md:col-start-3">
          <CompetitorLogo competitor={competitor} size={24} />
          {competitor.name}
        </ColumnHead>
        {[...keys, ...ROW_KEYS.filter((key) => !keys.includes(key))].map(
          (key, index) => {
            const cell = competitor.cells[key];
            const row = { "--row": index + 2 } as CSSProperties;
            const hidden = index >= keys.length ? "hidden" : "";
            return (
              <Fragment key={`${view}-${key}`}>
                <span
                  style={row}
                  className={`${hidden} relative animate-fade py-5 pr-4 md:col-start-1 md:row-start-(--row) font-medium max-md:pt-8 max-md:pb-3 max-md:text-xs max-md:text-muted-foreground md:border-t ${DOTTED}`}
                >
                  {LABELS[key]}
                </span>
                <span
                  style={row}
                  className={`${hidden} relative flex animate-fade gap-3 px-5 py-5 font-medium md:col-start-2 md:row-start-(--row) max-md:rounded-t-xl max-md:border max-md:bg-card max-md:px-4 max-md:py-3 md:border-t ${DOTTED} md:mx-px`}
                >
                  <span className="mt-0.5 shrink-0 md:hidden">
                    <Logo size={16} />
                  </span>
                  {OURS[key]}
                </span>
                <span
                  style={row}
                  className={`${hidden} relative flex animate-fade gap-3 px-5 py-5 md:col-start-3 md:row-start-(--row) max-md:rounded-b-xl max-md:bg-muted/72 max-md:px-4 max-md:py-3 md:border-t ${DOTTED}`}
                >
                  <span className="mt-0.5 shrink-0 md:hidden">
                    <CompetitorLogo competitor={competitor} size={16} />
                  </span>
                  <span>
                    {cell === undefined ? (
                      <span className="text-muted-foreground">
                        Not found in their docs.
                      </span>
                    ) : (
                      <>
                        {cell.text}
                        <SourceMarks items={cell.sources} sources={sources} />
                      </>
                    )}
                  </span>
                </span>
              </Fragment>
            );
          },
        )}
      </div>
      {view !== "all" && (
        <Button
          variant="ghost"
          className="mt-6 -ml-3"
          onClick={() => setView("all")}
          data-umami-event="Compare show all"
        >
          Show all {ROW_KEYS.length} rows
          <CaretDownIcon size={14} />
        </Button>
      )}
    </section>
  );
}

function ColumnHead({
  column,
  children,
}: {
  column: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`relative row-start-1 flex items-center gap-3 px-5 pt-5 pb-4 text-sm font-semibold max-md:hidden ${column}`}
    >
      {children}
    </span>
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
          <div
            key={title}
            className="flex gap-4 rounded-2xl border bg-card p-6 shadow-xs/5"
          >
            <CompetitorLogo competitor={competitor} size={24} />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {text}
              </span>
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
            <span className="mono text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CompetitorLogo competitor={competitor} size={16} />
            Before
          </p>
          <CodeBlock fileName={WORKFLOW} {...snippets.before} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="text-foreground">
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
    <section className={MUTED_BAND}>
      <div
        className={`${SECTION} grid grid-cols-[1fr_2fr] gap-12 max-lg:grid-cols-1`}
      >
        <LeadCopy title="Questions." className="max-w-[360px]">
          What to know before you move from {competitor.name}.
        </LeadCopy>
        <Accordion multiple className={`border-t ${DOTTED}`}>
          {competitor.faq.map(([question, answer]) => (
            <AccordionItem
              key={question}
              value={question}
              className="last:border-b"
            >
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionPanel className="max-w-[65ch] pb-5">
                {answer}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <section id="sources" className={`${WIDE} scroll-mt-16 pb-24 max-sm:pb-12`}>
      <p className="text-sm font-semibold">Sources</p>
      <p className="mt-1 text-xs text-muted-foreground">
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
            <span className="mono w-5 shrink-0 text-muted-foreground tabular-nums">
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
    <section className={MUTED_BAND}>
      <div
        className={`${SECTION} grid grid-cols-2 items-end gap-12 max-lg:grid-cols-1`}
      >
        <div>
          <h2 className={DISPLAY}>
            Every pixel, reviewed.
            <br />
            <span className="text-muted-foreground">
              Nothing ships by surprise.
            </span>
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <AuthButton label="Start free with GitHub" />
            <Button variant="ghost" render={<Link to="/docs" />}>
              Read the quickstart
            </Button>
          </div>
        </div>
        {current !== undefined && (
          <nav aria-label="Other comparisons">
            <p className="text-xs font-medium text-muted-foreground">
              Other comparisons
            </p>
            <ul className={`mt-3 border-t ${DOTTED}`}>
              {others.map((competitor) => (
                <li key={competitor.slug}>
                  <Link
                    to="/compare/$slug"
                    params={{ slug: competitor.slug }}
                    className={`group flex items-center gap-3 border-b ${DOTTED} py-3`}
                  >
                    <CompetitorLogo competitor={competitor} size={24} />
                    <span className="flex-1 text-sm font-medium">
                      vs {competitor.name}
                    </span>
                    <ArrowRightIcon
                      size={14}
                      className="text-muted-foreground transition-transform duration-100 group-hover:translate-x-0.5"
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
