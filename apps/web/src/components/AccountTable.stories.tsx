import type { Meta, StoryObj } from "@storybook/react-vite";
import { DAY_MS, STORY_NOW, storage } from "../lib/storyFixtures";
import { AccountTable } from "./AccountTable";

const meta = {
  title: "Account/Table",
  component: AccountTable,
  args: {
    accounts: [
      {
        login: "acme",
        type: "org",
        installed: true,
        plan: "100gb",
        storage: storage("100gb", 42.5),
        projects: 12,
        lastBuildAt: STORY_NOW - 2 * 60 * 60 * 1000,
      },
      {
        login: "octocat",
        type: "user",
        installed: true,
        plan: "free",
        storage: storage("free", 1.2),
        projects: 3,
        lastBuildAt: STORY_NOW - 9 * DAY_MS,
      },
      {
        login: "old-org",
        type: "org",
        installed: false,
        plan: "free",
        storage: storage("free", 0),
        projects: 0,
        lastBuildAt: null,
      },
    ],
  },
} satisfies Meta<typeof AccountTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { parameters: { theme: "dark" } };
