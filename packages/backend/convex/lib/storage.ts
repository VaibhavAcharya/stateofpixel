import { STORAGE_GRACE_MS, STORAGE_WARNING_SHARE } from "./limits";

const GIGABYTE = 1024 ** 3;

export const PLAN_STORAGE_LIMIT_BYTES = {
  free: 10 * GIGABYTE,
  "25gb": 25 * GIGABYTE,
  "100gb": 100 * GIGABYTE,
  "500gb": 500 * GIGABYTE,
} as const;

export type StorageUsage = {
  storageBytes: number;
  storageLimitBytes: number;
  overLimitSince?: number;
};

export type StorageState = "ok" | "warning" | "grace" | "blocked";

export function storageState(usage: StorageUsage, now: number): StorageState {
  if (usage.storageBytes < usage.storageLimitBytes * STORAGE_WARNING_SHARE) {
    return "ok";
  }
  if (usage.storageBytes < usage.storageLimitBytes) {
    return "warning";
  }
  return now < graceEndsAt(usage.overLimitSince ?? now) ? "grace" : "blocked";
}

export function graceEndsAt(overLimitSince: number): number {
  return overLimitSince + STORAGE_GRACE_MS;
}

export function withStorageBytes(
  usage: StorageUsage,
  storageBytes: number,
  now: number,
): { storageBytes: number; overLimitSince: number | undefined } {
  return {
    storageBytes,
    overLimitSince:
      storageBytes < usage.storageLimitBytes
        ? undefined
        : (usage.overLimitSince ?? now),
  };
}

export function formatGigabytes(bytes: number): string {
  return `${Number((bytes / GIGABYTE).toFixed(1))} GB`;
}

export function storageWarnings(usage: StorageUsage, now: number): string[] {
  const limit = formatGigabytes(usage.storageLimitBytes);
  switch (storageState(usage, now)) {
    case "ok":
      return [];
    case "warning":
      return [
        `Storage at ${Math.floor((usage.storageBytes / usage.storageLimitBytes) * 100)}% of the ${limit} limit.`,
      ];
    case "grace":
      return [
        `Storage limit of ${limit} reached. From ${formatDate(graceEndsAt(usage.overLimitSince ?? now))}, new images are not stored. Lower retention in project settings to free space.`,
      ];
    case "blocked":
      return [
        `Storage limit of ${limit} reached. New images are not stored, so changes are not compared. Lower retention in project settings to free space.`,
      ];
  }
}

function formatDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
