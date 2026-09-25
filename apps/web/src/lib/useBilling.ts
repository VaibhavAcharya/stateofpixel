import { api } from "@stateofpixel/backend/api";
import { useAction } from "convex/react";
import { useState } from "react";
import { errorCode } from "./errorCode";

export type PaidPlan = "25gb" | "100gb" | "500gb";

const ERRORS: Record<string, string> = {
  not_owner: "Only an owner of the account can change its plan.",
  already_subscribed:
    "This account already has a paid plan. Use Manage billing to change it.",
  billing_not_configured: "Paid plans are not available yet.",
};

export function useBilling() {
  const checkout = useAction(api.billing.checkout);
  const portal = useAction(api.billing.portal);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redirect(url: Promise<string>) {
    setPending(true);
    setError(null);
    try {
      window.location.assign(await url);
    } catch (reason) {
      setError(
        ERRORS[errorCode(reason) ?? ""] ?? "Could not open billing. Try again.",
      );
      setPending(false);
    }
  }

  return {
    pending,
    error,
    checkout: (login: string, plan: PaidPlan, interval: "monthly" | "yearly") =>
      redirect(checkout({ login, plan, interval })),
    manage: (login: string) => redirect(portal({ login })),
  };
}
