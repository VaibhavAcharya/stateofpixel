import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { Badge } from "uiofcraft";
import {
  CHECKED,
  COMPETITORS,
  type Competitor,
  type Priced,
} from "../../content/compare";
import { formatPrice } from "../landing/Pricing";
import { LEAD, PublicPage, WIDE } from "../landing/sections";
import { Logo } from "../ui";
import { CompetitorLogo, FinalBand } from "./ComparePage";
import { CostCalculator, DEFAULT_SUITE, quote } from "./CostCalculator";

const DOTTED = "border-border";

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
          <dt className="text-muted-foreground">{label}</dt>
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
    <p className="text-sm text-muted-foreground">
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
      className="group flex flex-col rounded-2xl border bg-card p-8 shadow-xs/5 transition-[box-shadow,border-color] duration-150 hover:border-input hover:shadow-lg/5 max-sm:p-5"
    >
      <span className="flex items-center gap-3">
        <CompetitorLogo competitor={competitor} size={40} />
        {competitor.status !== undefined && (
          <Badge variant="error" className="ml-auto">
            Shutting down
          </Badge>
        )}
      </span>
      <span className="mt-8 font-heading font-semibold text-[28px] leading-tight tracking-[-0.01em]">
        {competitor.name}
      </span>
      <span className="mt-2 text-sm text-muted-foreground text-balance">
        {competitor.hook}
      </span>
      <Facts competitor={competitor} />
      <span className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        {competitor.priced === null ? (
          <span className="text-sm text-muted-foreground">
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
      <section
        className={`${WIDE} flex flex-col gap-6 pt-10 pb-16 sm:pt-14 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10`}
      >
        <h1 className="text-balance font-heading font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-none tracking-[-0.02em] lg:col-span-7">
          How stateofpixel compares.
        </h1>
        <div className="flex flex-col items-start gap-5 lg:col-span-5 lg:pb-1.5">
          <p className="flex items-center text-foreground">
            <span className="mr-2 flex items-center">
              <Logo size={32} />
            </span>
            <span className="mono pr-3 text-muted-foreground text-xs">vs</span>
            <span className="flex flex-wrap gap-1.5">
              {COMPETITORS.map((competitor) => (
                <span key={competitor.slug}>
                  <CompetitorLogo competitor={competitor} size={32} />
                </span>
              ))}
            </span>
          </p>
          <p className={LEAD}>
            Chromatic, Percy, Applitools and Happo render in their own browsers.
            Argos and Lost Pixel use your CI, like we do, and BackstopJS runs
            wherever you run it. The paid plans bill per screenshot. We bill for
            storage.
          </p>
          <p className="text-muted-foreground text-xs">
            Every fact about them links to its source, checked on {CHECKED}.
          </p>
        </div>
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
