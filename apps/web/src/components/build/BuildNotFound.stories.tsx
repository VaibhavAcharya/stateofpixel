import type { Meta, StoryObj } from "@storybook/react-vite";
import { DAY_MS, STORY_NOW } from "../../lib/storyFixtures";
import { BuildDeleted, BuildNotFound } from "./BuildNotFound";

const meta = {
  title: "Build/Deleted",
  component: BuildDeleted,
  args: {
    owner: "acme",
    repo: "web",
    number: 412,
    deletion: {
      branch: "feat/pricing-toggle",
      prNumber: 42,
      reason: "pr_closed",
      retentionDays: 60,
      deletedAt: STORY_NOW - 3 * DAY_MS,
    },
  },
} satisfies Meta<typeof BuildDeleted>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PullRequestClosed: Story = {};

export const BranchInactive: Story = {
  args: {
    deletion: {
      branch: "experiment/dark-nav",
      prNumber: null,
      reason: "branch_inactive",
      retentionDays: 30,
      deletedAt: STORY_NOW - 3 * DAY_MS,
    },
  },
};

export const DeletedBeforeRecords: Story = {
  args: { deletion: null },
};

export const NotFound: Story = {
  render: () => <BuildNotFound title="Build not found." />,
};
