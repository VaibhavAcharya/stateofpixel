import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageStorage } from "./ImageStorage";

const meta = {
  title: "Account/Image storage",
  component: ImageStorage,
  args: { login: "acme", value: "convex" },
} satisfies Meta<typeof ImageStorage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Convex: Story = {};

export const Blobs: Story = { args: { value: "blobs" } };
