import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Toasts } from "./Toast";

const meta = {
  title: "App/Toasts",
  component: Toasts,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
  args: {
    dismiss: fn(),
    toasts: [
      {
        id: 1,
        tone: "success",
        text: "Build approved, check updated on GitHub",
      },
    ],
  },
} satisfies Meta<typeof Toasts>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const Failure: Story = {
  args: {
    toasts: [
      {
        id: 1,
        tone: "error",
        text: "Could not approve Pricing/Plans [chromium 1280]. Your change was undone.",
      },
    ],
  },
};

export const Stacked: Story = {
  args: {
    toasts: [
      {
        id: 1,
        tone: "success",
        text: "Build approved, check updated on GitHub",
      },
      { id: 2, tone: "error", text: "Could not approve all snapshots." },
      {
        id: 3,
        tone: "error",
        text: "Could not reject Settings/Billing/Plans and invoices [chromium 1280]. This build can no longer be reviewed.",
      },
    ],
  },
};

export const StackedDark: Story = {
  ...Stacked,
  parameters: { theme: "dark" },
};
