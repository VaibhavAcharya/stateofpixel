export type Plan = {
  name: string;
  price: number;
  included: number;
  extra: number | null;
  browsers?: number;
};

export const CHROMATIC: Plan[] = [
  { name: "Free", price: 0, included: 5_000, extra: null, browsers: 1 },
  { name: "Starter", price: 179, included: 35_000, extra: 0.008 },
  { name: "Pro", price: 399, included: 85_000, extra: 0.008 },
];

export const ARGOS: Plan[] = [
  { name: "Hobby", price: 0, included: 5_000, extra: null },
  { name: "Pro", price: 100, included: 35_000, extra: 0.004 },
];

export const PERCY: Plan[] = [
  { name: "Free", price: 0, included: 5_000, extra: null },
  { name: "Desktop 10k", price: 249, included: 10_000, extra: 0.036 },
  { name: "Desktop 25k", price: 549, included: 25_000, extra: 0.036 },
];

export const HAPPO: Plan[] = [
  { name: "Free", price: 0, included: 5_000, extra: null, browsers: 1 },
  { name: "Starter", price: 149, included: 50_000, extra: 0.006, browsers: 2 },
  { name: "Growth", price: 399, included: 150_000, extra: 0.006, browsers: 3 },
  { name: "Pro", price: 749, included: 300_000, extra: 0.006, browsers: 5 },
];

export type Quote = { plan: Plan; cost: number; extra: number };

export function cheapestPlan(
  plans: Plan[],
  snapshots: number,
  browsers = 1,
): Quote {
  const quotes = plans
    .filter((plan) => plan.extra !== null || snapshots <= plan.included)
    .filter((plan) => plan.browsers === undefined || browsers <= plan.browsers)
    .map((plan) => {
      const extra = Math.max(0, snapshots - plan.included);
      return { plan, extra, cost: plan.price + extra * (plan.extra ?? 0) };
    });
  return quotes.reduce((best, quote) =>
    quote.cost < best.cost ? quote : best,
  );
}
