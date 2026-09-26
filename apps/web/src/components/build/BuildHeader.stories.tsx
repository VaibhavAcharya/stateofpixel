import type { Id } from "@stateofpixel/backend/dataModel";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { STORY_NOW } from "../../lib/storyFixtures";
import { Banners, BuildHeader } from "./BuildHeader";
import type { Build } from "./types";

const MINUTE_MS = 60 * 1000;

const counts = {
  unchanged: 12,
  changed: 4,
  added: 1,
  removed: 1,
  failed: 0,
  pending: 5,
  approved: 0,
  rejected: 0,
};

const build: Build = {
  buildId: "build_1" as Id<"builds">,
  number: 412,
  buildName: "default",
  branch: "feat/billing",
  baselineBranch: "main",
  commitSha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  commitMessage: "Redesign the pricing and sign-in pages",
  prNumber: 88,
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
  counts,
  createdAt: STORY_NOW - 5 * MINUTE_MS,
  finalizedAt: STORY_NOW - 4 * MINUTE_MS,
};

const meta = {
  title: "Build/Header",
  component: BuildHeader,
  parameters: { layout: "fullscreen" },
  args: {
    build,
    owner: "acme",
    repo: "web",
    canWrite: true,
    canReview: true,
    onApproveAll: fn(),
    onRejectAll: fn(),
  },
  render: (args) => (
    <>
      <BuildHeader {...args} />
      <Banners build={args.build} owner={args.owner} repo={args.repo} />
    </>
  ),
} satisfies Meta<typeof BuildHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToReview: Story = {};

export const Approved: Story = {
  args: {
    build: {
      ...build,
      conclusion: "approved",
      counts: { ...counts, pending: 0, approved: 5 },
    },
  },
};

export const Rejected: Story = {
  args: {
    build: {
      ...build,
      conclusion: "rejected",
      counts: { ...counts, pending: 3, approved: 1, rejected: 1 },
    },
  },
};

export const NoChanges: Story = {
  args: {
    build: {
      ...build,
      conclusion: "no_changes",
      counts: { ...counts, changed: 0, added: 0, removed: 0, pending: 0 },
    },
  },
};

export const WithoutWriteAccess: Story = {
  args: { canWrite: false, canReview: false },
};

export const Waiting: Story = {
  args: {
    build: {
      ...build,
      status: "pending",
      conclusion: null,
      finalizedAt: null,
    },
  },
};

export const WaitingForShards: Story = {
  args: {
    build: {
      ...build,
      status: "pending",
      conclusion: null,
      finalizedAt: null,
      shards: { done: 2, total: 4 },
    },
  },
};

export const Expired: Story = {
  args: {
    build: { ...build, status: "expired", conclusion: null, finalizedAt: null },
  },
};

export const UploadFailed: Story = {
  args: {
    build: {
      ...build,
      status: "error",
      conclusion: null,
      finalizedAt: null,
      ciRunUrl: "https://github.com/acme/web/actions/runs/1",
    },
  },
};

export const UploadFailedWithoutLogs: Story = {
  args: {
    build: { ...build, status: "error", conclusion: null, finalizedAt: null },
  },
};

export const StorageBlocked: Story = {
  args: { build: { ...build, storageBlocked: true } },
};

export const Superseded: Story = {
  args: { build: { ...build, superseded: true, supersededBy: 415 } },
};

export const FromMergedPullRequest: Story = {
  args: {
    build: {
      ...build,
      branch: "main",
      prNumber: null,
      conclusion: "approved",
      autoApproved: true,
      counts: { ...counts, pending: 0, approved: 5 },
      mergedPr: { number: 88, lastBuildNumber: 410 },
    },
  },
};

export const FirstBuild: Story = {
  args: {
    build: {
      ...build,
      branch: "main",
      prNumber: null,
      baseline: null,
      conclusion: "approved",
      autoApproved: true,
      counts: {
        ...counts,
        changed: 0,
        removed: 0,
        added: 18,
        pending: 0,
        approved: 18,
      },
    },
  },
};
