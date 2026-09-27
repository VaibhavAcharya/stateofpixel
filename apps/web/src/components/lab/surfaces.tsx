import { CHECKED } from "../../content/compare";
import { formatPrice, TIERS } from "../landing/Pricing";
import { SECTION } from "../landing/sections";
import { AuthButton } from "../SignIn";
import { LeadCopy } from "../ui";
import { count, tierReach } from "./numbers";

const DOTTED = "border-dotted border-field-border/50";

const LIST_PRICE_LIMIT = 2_000_000;

/* Pricing */

export function PricingReach() {
  return (
    <section className={SECTION}>
      <LeadCopy
        title="Pay for storage, nothing else."
        className="max-w-[760px]"
      >
        Each plan shows what it holds, and what the same month costs elsewhere.
      </LeadCopy>
      <div className="mt-12 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {TIERS.map((tier) => {
          const reach = tierReach(tier.gigabytes);
          const free = tier.monthly === 0;
          return (
            <div
              key={tier.plan}
              className={`flex flex-col rounded-lg bg-surface p-6 ring-1 ring-border`}
            >
              <p className="text-base font-semibold">
                {free ? "Free" : `${tier.gigabytes} GB`}
              </p>
              <p className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                {formatPrice(tier.monthly)}
                <span className="text-sm font-normal tracking-normal opacity-70">
                  {" "}
                  /mo
                </span>
              </p>
              <p className="mt-6 text-sm">
                Holds about{" "}
                <span className="font-semibold tabular-nums">
                  {count.format(reach.snapshots)}
                </span>{" "}
                screenshots a month
              </p>
              {reach.snapshots > LIST_PRICE_LIMIT ? (
                <p
                  className={`mt-4 border-t ${DOTTED} pt-4 text-xs text-muted`}
                >
                  At this size, compare with their enterprise quotes.
                </p>
              ) : (
                <dl
                  className={`mt-4 flex flex-col gap-1 border-t ${DOTTED} pt-4 text-xs text-muted`}
                >
                  {(
                    [
                      ["Argos", reach.argos],
                      ["Chromatic", reach.chromatic],
                      ["Percy", reach.percy],
                    ] as const
                  ).map(([name, cost]) => (
                    <div key={name} className="flex justify-between">
                      <dt>{name}</dt>
                      <dd className="tabular-nums">{formatPrice(cost)}/mo</dd>
                    </div>
                  ))}
                </dl>
              )}
              {free && (
                <div className="mt-auto pt-6">
                  <AuthButton label="Start free" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 max-w-[90ch] text-xs text-muted">
        5% of screenshots change per build at 80 KB each, with their diffs, kept
        60 days. Cheapest list plan for each tool on {CHECKED}, before tax. A
        suite that changes more holds fewer screenshots.
      </p>
    </section>
  );
}
