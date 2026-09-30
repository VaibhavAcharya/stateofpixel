import { expect, it } from "vitest";
import { storageState, withStorageBytes } from "./storage.ts";

const LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

it("moves from ok to warning at 80% and to grace at the limit", () => {
  const state = (storageBytes: number) =>
    storageState({ storageBytes, storageLimitBytes: LIMIT }, 0);
  expect(state(799)).toBe("ok");
  expect(state(800)).toBe("warning");
  expect(state(1000)).toBe("grace");
});

it("blocks 14 days after the account went over the limit", () => {
  const usage = { storageBytes: LIMIT, storageLimitBytes: LIMIT };
  expect(storageState({ ...usage, overLimitSince: 0 }, 14 * DAY_MS - 1)).toBe(
    "grace",
  );
  expect(storageState({ ...usage, overLimitSince: 0 }, 14 * DAY_MS)).toBe(
    "blocked",
  );
});

it("starts the grace period once and ends it under the limit", () => {
  const under = { storageBytes: 900, storageLimitBytes: LIMIT };
  expect(withStorageBytes(under, 1000, 5)).toEqual({
    storageBytes: 1000,
    overLimitSince: 5,
  });
  expect(withStorageBytes({ ...under, overLimitSince: 5 }, 1100, 9)).toEqual({
    storageBytes: 1100,
    overLimitSince: 5,
  });
  expect(withStorageBytes({ ...under, overLimitSince: 5 }, 999, 9)).toEqual({
    storageBytes: 999,
    overLimitSince: null,
  });
});
