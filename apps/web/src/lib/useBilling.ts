import { api } from "@stateofpixel/backend/api";
import { useAction } from "convex/react";
import { useState } from "react";
import { errorCode } from "./errorCode";

export type PaidPlan = "25gb" | "100gb" | "500gb";
export type BillingInterval = "monthly" | "yearly";

export type PlanChange = {
  plan: PaidPlan;
  interval: BillingInterval;
  preview: { amount: number; currency: string; renewsAt: number } | null;
  submitted: boolean;
};

const ERRORS: Record<string, string> = {
  not_owner: "Only an owner of the account can change its plan.",
  already_subscribed:
    "This account already has a paid plan. Use Change plan to switch.",
  not_subscribed: "This account has no paid plan to change.",
  same_plan: "The account is already on this plan.",
  over_plan_limit:
    "The account stores more than this plan allows. Free some space first, or pick a larger plan.",
  billing_not_configured: "Paid plans are not available yet.",
};

function errorMessage(reason: unknown, fallback: string): string {
  return ERRORS[errorCode(reason) ?? ""] ?? fallback;
}

export function useBilling() {
  const checkout = useAction(api.billing.checkout);
  const portal = useAction(api.billing.portal);
  const previewPlanChange = useAction(api.billing.previewPlanChange);
  const changePlan = useAction(api.billing.changePlan);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [change, setChange] = useState<PlanChange | null>(null);

  async function redirect(url: Promise<string>) {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await url);
    } catch (reason) {
      setError(errorMessage(reason, "Could not open billing. Try again."));
      setPending(false);
    }
  }

  async function startChange(
    login: string,
    plan: PaidPlan,
    interval: BillingInterval,
  ) {
    const isCurrent = (current: PlanChange | null) =>
      current?.plan === plan && current.interval === interval;
    setError(null);
    setChange({ plan, interval, preview: null, submitted: false });
    try {
      const preview = await previewPlanChange({ login, plan, interval });
      setChange((current) =>
        isCurrent(current)
          ? { plan, interval, preview, submitted: false }
          : current,
      );
    } catch (reason) {
      setError(errorMessage(reason, "Could not check the price. Try again."));
      setChange((current) => (isCurrent(current) ? null : current));
    }
  }

  async function confirmChange(login: string) {
    if (change === null) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const paymentLink = await changePlan({
        login,
        plan: change.plan,
        interval: change.interval,
      });
      if (paymentLink !== null) {
        window.location.assign(paymentLink);
        return;
      }
      setChange({ ...change, submitted: true });
    } catch (reason) {
      setError(errorMessage(reason, "Could not change the plan. Try again."));
    }
    setPending(false);
  }

  return {
    pending,
    error,
    change,
    checkout: (login: string, plan: PaidPlan, interval: BillingInterval) =>
      redirect(checkout({ login, plan, interval })),
    manage: (login: string) => redirect(portal({ login })),
    startChange,
    confirmChange,
    cancelChange: () => setChange(null),
  };
}
