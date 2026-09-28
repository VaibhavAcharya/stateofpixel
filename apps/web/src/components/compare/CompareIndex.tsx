import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import {
  CHECKED,
  COMPETITORS,
  type Competitor,
  type Priced,
} from "../../content/compare";
import { formatPrice } from "../landing/Pricing";
import { DISPLAY, LEAD, PublicPage, WIDE } from "../landing/sections";
import { Logo } from "../ui";
import { CompetitorLogo, FinalBand } from "./ComparePage";
import { CostCalculator, DEFAULT_SUITE, quote } from "./CostCalculator";

const DOTTED = "border-dotted border-field-border/50";

const PRICED = COMPETITORS.flatMap((competitor) =>
  competitor.priced === null ? [] : [competitor.priced],
) satisfies Priced[];

function Facts({ competitor }: { competitor: Competitor }) {
  const rows = [
    ["Takes the screenshots", competitor.cells.renders?.text],
    ["Bills for", competitor.cells.billing?.text],
    ["Git hosts", competitor.cells.git?.text],
  ];
  return (
    <dl className={`mt-8 border-t ${DOTTED} text-sm`}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={`grid grid-cols-[140px_1fr] gap-4 border-b ${DOTTED} py-3 max-sm:grid-cols-1 max-sm:gap-1`}
        >
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CardBill({ priced }: { priced: Priced }) {
  const { snapshots, bills } = quote(DEFAULT_SUITE, [priced]);
  const [ours, theirs] = bills;
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-approved tabular-nums">
        {formatPrice(ours?.cost ?? 0)}
      </span>{" "}
      vs{" "}
      <span className="tabular-nums">
        {formatPrice(Math.round(theirs?.cost ?? 0))}
      </span>{" "}
      a month for {snapshots.toLocaleString("en-US")} screenshots
    </p>
  );
}

function CompetitorCard({ competitor }: { competitor: Competitor }) {
  return (
    <Link
      to="/compare/$slug"
      params={{ slug: competitor.slug }}
      className="group flex flex-col rounded-xl bg-surface p-8 ring-1 ring-border transition-shadow duration-150 hover:shadow-[0_8px_32px_#11151a14] max-sm:p-5"
    >
      <span className="flex items-center gap-3">
        <CompetitorLogo competitor={competitor} size={40} />
        {competitor.status !== undefined && (
          <span className="ml-auto rounded-full bg-rejected-bg px-2 py-0.5 text-xs font-medium text-rejected">
            Shutting down
          </span>
        )}
      </span>
      <span className="mt-8 text-[28px] leading-tight font-semibold tracking-[-0.035em]">
        {competitor.name}
      </span>
      <span className="mt-2 text-base text-muted text-balance">
        {competitor.hook}
      </span>
      <Facts competitor={competitor} />
      <span className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        {competitor.priced === null ? (
          <span className="text-sm text-muted">
            Move your Storybook in one step.
          </span>
        ) : (
          <CardBill priced={competitor.priced} />
        )}
        <span className="flex items-center gap-1.5 text-sm font-medium">
          Read the comparison
          <ArrowRightIcon
            size={14}
            className="transition-transform duration-100 group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  );
}

export function CompareIndex() {
  return (
    <PublicPage>
      <section className={`${WIDE} pt-24 pb-16 max-sm:pt-12`}>
        <p className="flex items-center gap-2 text-text">
          <Logo size={32} />
          <span className="mono px-1 text-xs text-muted">vs</span>
          {COMPETITORS.map((competitor) => (
            <CompetitorLogo
              key={competitor.slug}
              competitor={competitor}
              size={32}
            />
          ))}
        </p>
        <h1 className={`${DISPLAY} mt-8 max-w-[18ch]`}>
          How stateofpixel compares.
        </h1>
        <p className={`${LEAD} mt-6 max-w-[720px]`}>
          Chromatic and Percy render in their own browsers. Argos and Lost Pixel
          use your CI, like we do. Their paid plans bill per screenshot. We bill
          for storage.
        </p>
        <p className="mt-4 text-xs text-muted">
          Every fact about them links to its source, checked on {CHECKED}.
        </p>
      </section>
      <section className={`${WIDE} pb-24 max-sm:pb-12`}>
        <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
          {COMPETITORS.map((competitor) => (
            <CompetitorCard key={competitor.slug} competitor={competitor} />
          ))}
        </div>
      </section>
      <CostCalculator competitors={PRICED} />
      <FinalBand />
    </PublicPage>
  );
}
