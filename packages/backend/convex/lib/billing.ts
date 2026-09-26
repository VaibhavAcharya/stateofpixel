export type PaidPlan = "25gb" | "100gb" | "500gb";
export type BillingInterval = "monthly" | "yearly";
export type BillingEnvironment = "test_mode" | "live_mode";

type Products = Record<PaidPlan, Record<BillingInterval, string>>;

const PRODUCTS: Record<BillingEnvironment, Products> = {
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
  live_mode: {
    "25gb": {
      monthly: "pdt_0NoNGqRn7xwRKbLMoIV7h",
      yearly: "pdt_0NoNGqP68YncCaX9zV2PX",
    },
    "100gb": {
      monthly: "pdt_0NoNGqMVy9Gsk8hIP1vUT",
      yearly: "pdt_0NoNGqJp1kbBmPGrtZRN0",
    },
    "500gb": {
      monthly: "pdt_0NoNGqGX3movXlgQvbRgZ",
      yearly: "pdt_0NoNGqDnooOP4aP038gbd",
    },
  },
};

export function productId(
  environment: BillingEnvironment,
  plan: PaidPlan,
  interval: BillingInterval,
): string {
  return PRODUCTS[environment][plan][interval];
}

export function productPlan(
  environment: BillingEnvironment,
  productId: string,
): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const [plan, ids] of Object.entries(PRODUCTS[environment])) {
    for (const [interval, id] of Object.entries(ids)) {
      if (id === productId) {
        return {
          plan: plan as PaidPlan,
          interval: interval as BillingInterval,
        };
      }
    }
  }
  return null;
}

const ENDED_STATUSES = new Set(["cancelled", "expired", "failed"]);

export function isEndedStatus(status: string): boolean {
  return ENDED_STATUSES.has(status);
}
