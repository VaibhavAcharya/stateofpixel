import { conclude } from "@stateofpixel/backend/conclude";
import type { Id } from "@stateofpixel/backend/dataModel";
import { type ReactNode, useState } from "react";
import type { DiffStatus, ReviewState } from "../ui";
import { BuildNotFound } from "./BuildNotFound";
import { type BuildData, BuildDataContext, NEXT_STATE } from "./buildData";
import type { Build, Snapshot } from "./types";

const SIZE = { width: 600, height: 375 };
const AREA = SIZE.width * SIZE.height;
const MINUTE_MS = 60 * 1000;

type LabSnapshot = {
  id: string;
  name: string;
  diffStatus: DiffStatus;
  reviewState: ReviewState;
  diffPixels?: number;
  image: string | null;
  baselineImage: string | null;
  diffImage: string | null;
};

type LabBuildFixture = {
  build: Omit<
    Build,
    "counts" | "conclusion" | "buildId" | "createdAt" | "finalizedAt"
  >;
  snapshots: LabSnapshot[];
};

function changed(
  id: string,
  name: string,
  diffPixels: number,
  reviewState: ReviewState = "pending",
): LabSnapshot {
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

function unchanged(id: string, name: string, image: string): LabSnapshot {
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

function notStored(snapshot: LabSnapshot): LabSnapshot {
  return { ...snapshot, reviewState: "none", image: null, diffImage: null };
}

const BASE_BUILD = {
  buildName: "default",
  branch: "feat/billing",
  baselineBranch: "main",
  commitSha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  commitMessage: "Redesign the pricing and sign-in pages",
  prNumber: 88,
  status: "finalized",
  superseded: false,
  shards: { done: 1, total: 1 },
  autoApproved: false,
  storageBlocked: false,
  ciRunUrl: null,
  baseline: { number: 405, branch: "main" },
  supersededBy: null,
  mergedPr: null,
} as const;

const REVIEW_SNAPSHOTS: LabSnapshot[] = [
  changed("buttons", "Button/All [600]", 1829, "approved"),
  changed("header", "Header/Default [600]", 540),
  changed("pricing", "Pricing/Plans [600]", 78),
  changed("signin", "Sign in/Error [600]", 3393),
  {
    id: "invoices",
    name: "Invoices/Empty [600]",
    diffStatus: "added",
    reviewState: "pending",
    image: "/demo/invoices-new.png",
    baselineImage: null,
    diffImage: null,
  },
  {
    id: "settings",
    name: "Settings/Legacy [600]",
    diffStatus: "removed",
    reviewState: "none",
    image: null,
    baselineImage: "/demo/header-base.png",
    diffImage: null,
  },
  unchanged("footer", "Footer/Default [600]", "/demo/header-base.png"),
  unchanged("nav", "Navigation/Mobile [600]", "/demo/buttons-base.png"),
  unchanged("pricing-free", "Pricing/Free [600]", "/demo/pricing-base.png"),
];

const FIXTURES: Record<number, LabBuildFixture> = {
  1: { build: { ...BASE_BUILD, number: 1 }, snapshots: REVIEW_SNAPSHOTS },
  2: {
    build: { ...BASE_BUILD, number: 2, storageBlocked: true },
    snapshots: REVIEW_SNAPSHOTS.map((snapshot) =>
      snapshot.diffStatus === "changed" || snapshot.diffStatus === "added"
        ? notStored(snapshot)
        : snapshot,
    ),
  },
};

function toImage(url: string | null) {
  return url === null ? null : { url, ...SIZE };
}

function countSnapshots(snapshots: LabSnapshot[]): Build["counts"] {
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

export default function LabBuild({
  number,
  children,
}: {
  number: number;
  children: (build: Build) => ReactNode;
}) {
  const fixture = FIXTURES[number];
  const [createdAt] = useState(() => Date.now() - 5 * MINUTE_MS);
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>(
    {},
  );
  if (fixture === undefined) {
    return <BuildNotFound title="Build not found." />;
  }

  const snapshots = fixture.snapshots.map((snapshot) => ({
    ...snapshot,
    reviewState: reviewStates[snapshot.id] ?? snapshot.reviewState,
  }));
  const counts = countSnapshots(snapshots);
  const build: Build = {
    ...fixture.build,
    buildId: `lab-${number}` as Id<"builds">,
    counts,
    conclusion: fixture.build.storageBlocked ? "changes" : conclude(counts),
    createdAt,
    finalizedAt: createdAt + MINUTE_MS,
  };

  const data: BuildData = {
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
                login: "octocat",
                comment: null,
                createdAt,
                carriedFrom: null,
              }
            : null,
        rejectedIn: null,
        notReviewedOnPr: false,
        history: [],
      };
    },
    useApplyReview:
      () =>
      async ({ snapshotIds, action }) => {
        setReviewStates((current) => {
          const next = { ...current };
          for (const snapshot of snapshots) {
            const selected =
              snapshotIds === "all"
                ? snapshot.reviewState === "pending"
                : snapshotIds.includes(snapshot.id as Id<"snapshots">);
            if (selected && snapshot.reviewState !== "none") {
              next[snapshot.id] = NEXT_STATE[action];
            }
          }
          return next;
        });
      },
  };

  return (
    <BuildDataContext.Provider value={data}>
      {children(build)}
    </BuildDataContext.Provider>
  );
}
