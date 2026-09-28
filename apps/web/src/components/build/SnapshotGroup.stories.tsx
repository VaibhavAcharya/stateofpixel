import type { Id } from "@stateofpixel/backend/dataModel";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SnapshotGroup } from "./SnapshotGroup";
import type { SnapshotRow } from "./types";

const AREA = 600 * 375;

function row(
  id: string,
  name: string,
  fields: Partial<SnapshotRow> = {},
): SnapshotRow {
  return {
    id: id as Id<"snapshots">,
    name,
    diffStatus: "changed",
    reviewState: "pending",
    diffRatio: 540 / AREA,
    ...fields,
  };
}

const rows = [
  row("1", "Button/All [chromium 1280]", {
    reviewState: "approved",
    diffRatio: 1829 / AREA,
  }),
  row("2", "Header/Default [chromium 1280]"),
  row("3", "Pricing/Plans [chromium 1280]", {
    reviewState: "rejected",
    diffRatio: 0.00001,
  }),
  row("4", "Sign in/Error [chromium 375]", { diffRatio: 3393 / AREA }),
  row(
    "5",
    "Settings/Billing/Plans and invoices with a very long name [chromium 1280]",
  ),
];

const meta = {
  title: "Build/Snapshot group",
  component: SnapshotGroup,
  decorators: [
    (Story) => (
      <div className="w-72 bg-surface p-2">
        <Story />
      </div>
    ),
  ],
  args: {
    status: "changed",
    label: "Changed",
    count: rows.length,
    open: true,
    onToggle: fn(),
    rows,
    loading: false,
    canLoadMore: false,
    onLoadMore: fn(),
    selectedId: "2",
    linkParams: { owner: "acme", repo: "web", number: "412" },
    onSelect: fn(),
  },
} satisfies Meta<typeof SnapshotGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Changed: Story = {};

export const ChangedDark: Story = { parameters: { theme: "dark" } };

export const Closed: Story = { args: { open: false } };

export const Loading: Story = { args: { rows: [], loading: true } };

export const CanLoadMore: Story = { args: { count: 240, canLoadMore: true } };

export const Added: Story = {
  args: {
    status: "added",
    label: "Added",
    count: 1,
    selectedId: undefined,
    rows: [
      row("6", "Invoices/Empty [chromium 1280]", {
        diffStatus: "added",
        diffRatio: null,
      }),
    ],
  },
};

export const Unchanged: Story = {
  args: {
    status: "unchanged",
    label: "Unchanged",
    count: 2,
    selectedId: undefined,
    rows: [
      row("7", "Footer/Default [chromium 1280]", {
        diffStatus: "unchanged",
        reviewState: "none",
        diffRatio: null,
      }),
      row("8", "Navigation/Mobile [chromium 375]", {
        diffStatus: "unchanged",
        reviewState: "none",
        diffRatio: null,
      }),
    ],
  },
};

export const Failed: Story = {
  args: {
    status: "failed",
    label: "Failed",
    count: 1,
    selectedId: undefined,
    rows: [
      row("9", "Chart/Live [chromium 1280]", {
        diffStatus: "failed",
        reviewState: "none",
        diffRatio: null,
      }),
    ],
  },
};
