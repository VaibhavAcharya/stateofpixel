import type { Id } from "@stateofpixel/backend/dataModel";
import { PLAN_STORAGE_LIMIT_BYTES } from "@stateofpixel/backend/storage";
import type { ReactNode } from "react";
import type { Build } from "../components/build/types";
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

const AVATAR_COLORS = ["#0068d6", "#297a3a", "#a35200", "#7820bc", "#cb2a2f"];

export function avatar(login: string): string {
  const color =
    AVATAR_COLORS[
      [...login].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        AVATAR_COLORS.length
    ];
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${color}"/><rect x="1" y="1" width="2" height="2" fill="#fff" opacity="0.6"/></svg>`,
  )}`;
}

export function withMenuRoom(Story: () => ReactNode) {
  return (
    <div className="min-h-96">
      <Story />
    </div>
  );
}

const DEMO_SIZE = { width: 600, height: 375 };

export function demoImage(file: string) {
  return { url: `/demo/${file}.png`, ...DEMO_SIZE };
}

export const DEMO_IMAGES = ["buttons", "header", "pricing", "signin"].flatMap(
  (id) => [
    `/demo/${id}-base.png`,
    `/demo/${id}-new.png`,
    `/demo/${id}-diff.png`,
  ],
);

export async function preloadDemoImages() {
  await Promise.all(
    [...DEMO_IMAGES, "/demo/invoices-new.png"].map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => undefined);
    }),
  );
  return {};
}

const MINUTE_MS = 60 * 1000;

export const buildCounts = {
  unchanged: 12,
  changed: 4,
  added: 1,
  removed: 1,
  failed: 0,
  pending: 5,
  approved: 0,
  rejected: 0,
};

export const build: Build = {
  buildId: "build_1" as Id<"builds">,
  number: 412,
  buildName: "default",
  branch: "feat/billing",
  baselineBranch: "main",
  commitSha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  commitMessage: "Redesign the pricing and sign-in pages",
  prNumber: 88,
  prState: "open",
  status: "finalized",
  conclusion: "changes",
  superseded: false,
  shards: { done: 1, total: 1 },
  autoApproved: false,
  storageBlocked: false,
  ciRunUrl: null,
  baseline: { number: 405, branch: "main" },
  supersededBy: null,
  mergedPr: null,
  counts: buildCounts,
  createdAt: STORY_NOW - 5 * MINUTE_MS,
  finalizedAt: STORY_NOW - 4 * MINUTE_MS,
};
