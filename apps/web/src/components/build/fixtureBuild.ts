import { conclude } from "@stateofpixel/backend/conclude";
import type { Id } from "@stateofpixel/backend/dataModel";
import { useState } from "react";
import type { DiffStatus, ReviewState } from "../ui";
import { BUILD_DATA, type BuildData, NEXT_STATE } from "./buildData";
import type { Build, Snapshot } from "./types";

const SIZE = { width: 600, height: 375 };
const AREA = SIZE.width * SIZE.height;
const MINUTE_MS = 60 * 1000;

export type FixtureSnapshot = {
  id: string;
  name: string;
  diffStatus: DiffStatus;
  reviewState: ReviewState;
  diffPixels?: number;
  browser?: string;
  image: string | null;
  baselineImage: string | null;
  diffImage: string | null;
};

export type BuildFixture = {
  build: Omit<
    Build,
    | "counts"
    | "conclusion"
    | "buildId"
    | "createdAt"
    | "finalizedAt"
    | "browsers"
  >;
  snapshots: FixtureSnapshot[];
  reviewer: string;
};

export function changed(
  id: string,
  name: string,
  diffPixels: number,
  reviewState: ReviewState = "pending",
): FixtureSnapshot {
  return {
    id,
    name,
    diffStatus: "changed",
    reviewState,
    diffPixels,
    image: `/demo/${id}-new.png`,
    baselineImage: `/demo/${id}-base.png`,
    diffImage: `/demo/${id}-diff.png`,
  };
}

export function unchanged(
  id: string,
  name: string,
  image: string,
): FixtureSnapshot {
  return {
    id,
    name,
    diffStatus: "unchanged",
    reviewState: "none",
    image,
    baselineImage: image,
    diffImage: null,
  };
}

function toImage(url: string | null) {
  return url === null ? null : { url, ...SIZE };
}

function countSnapshots(snapshots: FixtureSnapshot[]): Build["counts"] {
  const counts = {
    unchanged: 0,
    changed: 0,
    added: 0,
    removed: 0,
    failed: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  for (const snapshot of snapshots) {
    counts[snapshot.diffStatus]++;
    if (snapshot.reviewState !== "none") {
      counts[snapshot.reviewState]++;
    }
  }
  return counts;
}

export function useFixtureBuild(fixture: BuildFixture): {
  build: Build;
  data: BuildData;
} {
  const [createdAt] = useState(
    () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS - 5 * MINUTE_MS,
  );
  const [reviews, setReviews] = useState<
    Record<
      string,
      { state: ReviewState; comment: string | null; reviewedAt: number }
    >
  >({});

  const snapshots = fixture.snapshots.map((snapshot) => ({
    ...snapshot,
    reviewState: reviews[snapshot.id]?.state ?? snapshot.reviewState,
    comment: reviews[snapshot.id]?.comment ?? null,
    reviewedAt: reviews[snapshot.id]?.reviewedAt ?? createdAt,
  }));
  const counts = countSnapshots(snapshots);
  const build: Build = {
    ...fixture.build,
    buildId: `fixture-${fixture.build.number}` as Id<"builds">,
    counts,
    conclusion: fixture.build.storageBlocked ? "changes" : conclude(counts),
    createdAt,
    finalizedAt: createdAt + MINUTE_MS,
    browsers: [
      ...new Set(snapshots.flatMap((snapshot) => snapshot.browser ?? [])),
    ].sort(),
  };

  const data: BuildData = {
    ...BUILD_DATA,
    useSnapshotGroups: () => {
      const list = (diffStatus: DiffStatus) => ({
        results: snapshots
          .filter((snapshot) => snapshot.diffStatus === diffStatus)
          .map((snapshot) => ({
            id: snapshot.id as Id<"snapshots">,
            name: snapshot.name,
            diffStatus: snapshot.diffStatus,
            reviewState: snapshot.reviewState,
            diffRatio:
              snapshot.diffPixels === undefined
                ? null
                : snapshot.diffPixels / AREA,
            browser: snapshot.browser ?? null,
          })),
        status: "Exhausted" as const,
        loadMore: () => {},
      });
      return {
        changed: list("changed"),
        added: list("added"),
        removed: list("removed"),
        failed: list("failed"),
        unchanged: list("unchanged"),
      };
    },
    useSnapshot: ({ snapshotId }): Snapshot | null => {
      const snapshot = snapshots.find((item) => item.id === snapshotId);
      if (snapshot === undefined) {
        return null;
      }
      return {
        id: snapshot.id as Id<"snapshots">,
        buildId: build.buildId,
        name: snapshot.name,
        diffStatus: snapshot.diffStatus,
        reviewState: snapshot.reviewState,
        diffRatio:
          snapshot.diffPixels === undefined ? null : snapshot.diffPixels / AREA,
        diffPixels: snapshot.diffPixels ?? null,
        metadata: {},
        image: toImage(snapshot.image),
        baselineImage: toImage(snapshot.baselineImage),
        diffImage: toImage(snapshot.diffImage),
        lastReview:
          snapshot.reviewState === "approved" ||
          snapshot.reviewState === "rejected"
            ? {
                action:
                  snapshot.reviewState === "approved" ? "approve" : "reject",
                source: "user",
                login: fixture.reviewer,
                comment: snapshot.comment,
                createdAt: snapshot.reviewedAt,
                carriedFrom: null,
              }
            : null,
        rejectedIn: null,
        notReviewedOnPr: false,
        history: [],
        flaky: null,
      };
    },
    useApplyReview:
      () =>
      async ({ snapshotIds, action, comment }) => {
        setReviews((current) => {
          const next = { ...current };
          for (const snapshot of snapshots) {
            const selected =
              snapshotIds === "all"
                ? snapshot.reviewState === "pending"
                : snapshotIds.includes(snapshot.id as Id<"snapshots">);
            if (selected && snapshot.reviewState !== "none") {
              next[snapshot.id] = {
                state: NEXT_STATE[action],
                comment: comment || null,
                reviewedAt: Date.now(),
              };
            }
          }
          return next;
        });
      },
  };

  return { build, data };
}
