import { describe, expect, it } from "vitest";
import { accountAlert, type Subscription } from "./accountAlert";

const GIGABYTE = 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 26);

const storage = (gigabytes: number, overLimitSince?: number) => ({
  storageBytes: gigabytes * GIGABYTE,
  storageLimitBytes: 25 * GIGABYTE,
  overLimitSince,
});

const subscription = (fields: Partial<Subscription>): Subscription => ({
  id: "sub_1",
  status: "active",
  interval: "monthly",
  periodEndsAt: now + 30 * DAY_MS,
  cancelsAtPeriodEnd: false,
  ...fields,
});

describe("accountAlert", () => {
  it("shows nothing for an active plan with room", () => {
    expect(accountAlert(storage(5), subscription({}), now)).toBeNull();
  });

  it("puts a blocked account before a failed payment", () => {
    expect(
      accountAlert(
        storage(26, now - 15 * DAY_MS),
        subscription({ status: "on_hold" }),
        now,
      ),
    ).toEqual({ kind: "storage", state: "blocked" });
  });

  it("puts a failed payment before the storage warning", () => {
    expect(
      accountAlert(storage(21), subscription({ status: "past_due" }), now),
    ).toEqual({ kind: "payment_failed" });
  });

  it("warns early when a cancelled plan ends with more than the Free plan stores", () => {
    expect(
      accountAlert(
        storage(12),
        subscription({ cancelsAtPeriodEnd: true }),
        now,
      ),
    ).toEqual({
      kind: "plan_ends",
      endsAt: now + 30 * DAY_MS,
      overFreeLimit: true,
    });
  });

  it("warns two weeks before a cancelled plan ends when the Free plan fits", () => {
    const cancelled = (days: number) =>
      subscription({
        cancelsAtPeriodEnd: true,
        periodEndsAt: now + days * DAY_MS,
      });
    expect(accountAlert(storage(2), cancelled(15), now)).toBeNull();
    expect(accountAlert(storage(2), cancelled(13), now)).toEqual({
      kind: "plan_ends",
      endsAt: now + 13 * DAY_MS,
      overFreeLimit: false,
    });
  });

  it("warns at 80% of the limit", () => {
    expect(accountAlert(storage(20), null, now)).toEqual({
      kind: "storage",
      state: "warning",
    });
  });
});
