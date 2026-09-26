import { PLAN_STORAGE_LIMIT_BYTES } from "@stateofpixel/backend/storage";
import type { PLAN_NAMES } from "../components/PlanBox";
import type { Subscription } from "./accountAlert";

export const STORY_NOW = Date.UTC(2026, 8, 26, 12);
export const DAY_MS = 24 * 60 * 60 * 1000;

const GIGABYTE = 1024 ** 3;

export function storage(
  plan: keyof typeof PLAN_STORAGE_LIMIT_BYTES,
  gigabytes: number,
  overLimitDays?: number,
) {
  return {
    plan: plan as keyof typeof PLAN_NAMES,
    storageBytes: gigabytes * GIGABYTE,
    storageLimitBytes: PLAN_STORAGE_LIMIT_BYTES[plan],
    overLimitSince:
      overLimitDays === undefined
        ? undefined
        : STORY_NOW - overLimitDays * DAY_MS,
  };
}

export function subscription(fields: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1",
    status: "active",
    interval: "monthly",
    periodEndsAt: STORY_NOW + 20 * DAY_MS,
    cancelsAtPeriodEnd: false,
    ...fields,
  };
}
