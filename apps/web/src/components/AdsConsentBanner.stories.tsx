import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AdsConsentPrompt } from "./AdsConsentBanner";

const meta = {
  title: "App/AdsConsentPrompt",
  component: AdsConsentPrompt,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-80">
        <Story />
      </div>
    ),
  ],
  args: { onChoose: fn() },
} satisfies Meta<typeof AdsConsentPrompt>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  parameters: { theme: "dark" },
};
