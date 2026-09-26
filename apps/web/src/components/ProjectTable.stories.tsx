import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { STORY_NOW } from "../lib/storyFixtures";
import { ProjectTable } from "./ProjectTable";

const HOUR_MS = 60 * 60 * 1000;

const counts = {
  unchanged: 40,
  changed: 3,
  added: 1,
  removed: 0,
  failed: 0,
  pending: 4,
  approved: 0,
  rejected: 0,
};

function build(
  number: number,
  fields: Record<string, unknown> = {},
  hoursAgo = 2,
) {
  return {
    number,
    branch: "main",
    status: "finalized",
    conclusion: "approved",
    counts,
    storageBlocked: false,
    createdAt: STORY_NOW - hoursAgo * HOUR_MS,
    ...fields,
  };
}

const rows = [
  {
    owner: "acme",
    name: "web",
    private: true,
    latestBuild: build(412, { branch: "feat/billing", conclusion: "changes" }),
  },
  {
    owner: "acme",
    name: "design-system",
    private: false,
    latestBuild: build(88, {}, 30),
  },
  {
    owner: "acme",
    name: "docs",
    private: false,
    latestBuild: build(
      19,
      {
        branch: "fix/sidebar",
        conclusion: "rejected",
        counts: { ...counts, rejected: 1 },
      },
      5,
    ),
  },
  {
    owner: "acme",
    name: "marketing-site-with-a-long-repository-name",
    private: true,
    latestBuild: build(7, { status: "pending", conclusion: null }, 0),
  },
  {
    owner: "acme",
    name: "mobile",
    private: true,
    latestBuild: build(33, { storageBlocked: true, conclusion: "changes" }, 50),
  },
  { owner: "acme", name: "sandbox", private: false, latestBuild: null },
];

const page = (status: string, results = rows) => ({
  "accounts:projects": {
    results,
    status,
    isLoading: status.startsWith("Loading"),
    loadMore: fn(),
  },
});

const meta = {
  title: "Account/Project table",
  component: ProjectTable,
  parameters: { convex: page("Exhausted") },
  args: {
    login: "acme",
    search: {},
    onSearchChange: fn(),
    empty:
      "No repositories yet. Pick the repositories to test in the GitHub App settings.",
  },
} satisfies Meta<typeof ProjectTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Projects: Story = {};

export const ProjectsDark: Story = { parameters: { theme: "dark" } };

export const SortedByUpdated: Story = {
  args: { search: { sort: "updated" } },
};

export const Loading: Story = {
  parameters: { convex: page("LoadingFirstPage", []) },
};

export const CanLoadMore: Story = {
  parameters: { convex: page("CanLoadMore") },
};

export const LoadingMore: Story = {
  parameters: { convex: page("LoadingMore") },
};

export const Empty: Story = {
  parameters: { convex: page("Exhausted", []) },
};

export const NoMatch: Story = {
  args: { search: { q: "billing" } },
  parameters: { convex: page("Exhausted", []) },
};
