import type { ReactNode } from "react";
import { LAB_OWNER } from "../../lib/lab";
import {
  BuildDeleted,
  type BuildDeletion,
  BuildNotFound,
} from "./BuildNotFound";
import { BuildDataContext } from "./buildData";
import {
  type BuildFixture,
  changed,
  type FixtureSnapshot,
  unchanged,
  useFixtureBuild,
} from "./fixtureBuild";
import type { Build } from "./types";

function notStored(snapshot: FixtureSnapshot): FixtureSnapshot {
  return { ...snapshot, reviewState: "none", image: null, diffImage: null };
}

const BASE_BUILD = {
  buildName: "default",
  branch: "feat/billing",
  baselineBranch: "main",
  commitSha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  commitMessage: "Redesign the pricing and sign-in pages",
  prNumber: 88,
  prState: "open",
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

const REVIEW_SNAPSHOTS: FixtureSnapshot[] = [
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

const FIXTURES: Record<number, BuildFixture> = {
  1: {
    build: { ...BASE_BUILD, number: 1 },
    snapshots: REVIEW_SNAPSHOTS,
    reviewer: "octocat",
  },
  2: {
    build: { ...BASE_BUILD, number: 2, storageBlocked: true },
    snapshots: REVIEW_SNAPSHOTS.map((snapshot) =>
      snapshot.diffStatus === "changed" || snapshot.diffStatus === "added"
        ? notStored(snapshot)
        : snapshot,
    ),
    reviewer: "octocat",
  },
};

const DELETED: Record<number, BuildDeletion> = {
  3: {
    branch: "feat/pricing-toggle",
    prNumber: 42,
    reason: "pr_closed",
    retentionDays: 60,
    deletedAt: Date.UTC(2026, 8, 3, 12),
  },
};

export default function LabBuild({
  number,
  children,
}: {
  number: number;
  children: (build: Build) => ReactNode;
}) {
  const fixture = FIXTURES[number];
  if (fixture === undefined) {
    const deletion = DELETED[number];
    return deletion === undefined ? (
      <BuildNotFound title="Build not found." />
    ) : (
      <BuildDeleted
        owner={LAB_OWNER}
        repo="web"
        number={number}
        deletion={deletion}
      />
    );
  }
  return <LabFixture fixture={fixture}>{children}</LabFixture>;
}

function LabFixture({
  fixture,
  children,
}: {
  fixture: BuildFixture;
  children: (build: Build) => ReactNode;
}) {
  const { build, data } = useFixtureBuild(fixture);
  return (
    <BuildDataContext.Provider value={data}>
      {children(build)}
    </BuildDataContext.Provider>
  );
}
