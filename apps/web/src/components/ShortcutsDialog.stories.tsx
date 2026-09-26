import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ShortcutsDialog } from "./ShortcutsDialog";

const meta = {
  title: "App/Shortcuts dialog",
  component: ShortcutsDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-[720px]">
        <Story />
      </div>
    ),
  ],
  args: { open: true, onClose: fn() },
} satisfies Meta<typeof ShortcutsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const OpenDark: Story = { parameters: { theme: "dark" } };
