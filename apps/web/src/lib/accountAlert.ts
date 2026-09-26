import { PLAN_END_NOTICE_MS } from "@stateofpixel/backend/limits";
import {
  PLAN_STORAGE_LIMIT_BYTES,
  type StorageUsage,
  storageState,
} from "@stateofpixel/backend/storage";
import type { BillingInterval } from "./useBilling";

export type Subscription = {
  id: string;
  status: string;
  interval: BillingInterval | null;
  periodEndsAt: number | null;
  cancelsAtPeriodEnd: boolean;
};

export type AccountAlert =
  | { kind: "storage"; state: "warning" | "grace" | "blocked" }
  | { kind: "payment_failed" }
  | { kind: "plan_ends"; endsAt: number; overFreeLimit: boolean };

const FAILED_RENEWAL_STATUSES = new Set(["on_hold", "past_due"]);

export function isFailedRenewal(subscription: Subscription | null): boolean {
  return (
    subscription !== null && FAILED_RENEWAL_STATUSES.has(subscription.status)
  );
}

export function accountAlert(
  storage: StorageUsage,
  subscription: Subscription | null,
  now: number,
): AccountAlert | null {
  const state = storageState(storage, now);
  if (state === "blocked" || state === "grace") {
    return { kind: "storage", state };
  }
  if (isFailedRenewal(subscription)) {
    return { kind: "payment_failed" };
  }
  if (
    subscription?.status === "active" &&
    subscription.cancelsAtPeriodEnd &&
    subscription.periodEndsAt !== null
  ) {
    const overFreeLimit = storage.storageBytes >= PLAN_STORAGE_LIMIT_BYTES.free;
    if (overFreeLimit || subscription.periodEndsAt - now < PLAN_END_NOTICE_MS) {
      return {
        kind: "plan_ends",
        endsAt: subscription.periodEndsAt,
        overFreeLimit,
      };
    }
  }
  return state === "warning" ? { kind: "storage", state } : null;
}
