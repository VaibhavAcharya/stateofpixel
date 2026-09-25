export type PaidPlan = "25gb" | "100gb" | "500gb";
export type BillingInterval = "monthly" | "yearly";
export type BillingEnvironment = "test_mode" | "live_mode";

type Products = Record<PaidPlan, Record<BillingInterval, string>>;

const PRODUCTS: Record<BillingEnvironment, Products | null> = {
  test_mode: {
    "25gb": {
      monthly: "pdt_0NoN5TjZdBKHRU6UskUXu",
      yearly: "pdt_0NoN5TkmQYfTdkk8v4Ie9",
    },
    "100gb": {
      monthly: "pdt_0NoN5TmzAX5haoNeqGn77",
      yearly: "pdt_0NoN5ToBDApZ02O0BMR1K",
    },
    "500gb": {
      monthly: "pdt_0NoN5TpO13SyWcNaGrObo",
      yearly: "pdt_0NoN5TqaocuLYlshKDb9V",
    },
  },
  live_mode: null,
};

export function productId(
  environment: BillingEnvironment,
  plan: PaidPlan,
  interval: BillingInterval,
): string | null {
  return PRODUCTS[environment]?.[plan][interval] ?? null;
}

export function planForProduct(
  environment: BillingEnvironment,
  productId: string,
): PaidPlan | null {
  const products = PRODUCTS[environment];
  if (products === null) {
    return null;
  }
  for (const [plan, ids] of Object.entries(products)) {
    if (ids.monthly === productId || ids.yearly === productId) {
      return plan as PaidPlan;
    }
  }
  return null;
}

const ENDED_STATUSES = new Set(["cancelled", "expired", "failed"]);

export function isEndedStatus(status: string): boolean {
  return ENDED_STATUSES.has(status);
}
