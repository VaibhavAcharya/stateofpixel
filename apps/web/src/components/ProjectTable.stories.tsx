import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
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

const page = (isDone: boolean, results = rows) => ({
  "accounts.projects": {
    pages: [{ page: results, isDone, continueCursor: String(results.length) }],
    pageParams: [{ numItems: 25, cursor: null }],
  },
});

const meta = {
  title: "Account/Project table",
  component: ProjectTable,
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

export const Projects: Story = { parameters: { backend: page(true) } };

export const ProjectsDark: Story = {
  parameters: { backend: page(true), theme: "dark" },
};

export const SortedByUpdated: Story = {
  args: { search: { sort: "updated" } },
  parameters: { backend: page(true) },
};

export const Loading: Story = {};

export const CanLoadMore: Story = {
  parameters: { backend: page(false) },
};

export const LoadingMore: Story = {
  parameters: { backend: page(false) },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Load more" }),
    );
  },
};

export const Empty: Story = {
  parameters: { backend: page(true, []) },
};

export const NoMatch: Story = {
  args: { search: { q: "billing" } },
  parameters: { backend: page(true, []) },
};
