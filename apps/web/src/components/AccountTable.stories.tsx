import type { Meta, StoryObj } from "@storybook/react-vite";
import { avatar, DAY_MS, STORY_NOW, storage } from "../lib/storyFixtures";
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
        members: {
          count: 9,
          faces: ["octocat", "hubot", "monalisa", "defunkt"].map((login) => ({
            login,
            image: avatar(login),
          })),
        },
      },
      {
        login: "octocat",
        type: "user",
        installed: true,
        plan: "free",
        storage: storage("free", 1.2),
        projects: 3,
        lastBuildAt: STORY_NOW - 9 * DAY_MS,
        members: {
          count: 1,
          faces: [{ login: "octocat", image: avatar("octocat") }],
        },
      },
      {
        login: "old-org",
        type: "org",
        installed: false,
        plan: "free",
        storage: storage("free", 0),
        projects: 0,
        lastBuildAt: null,
        members: { count: 0, faces: [] },
      },
    ],
  },
} satisfies Meta<typeof AccountTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { parameters: { theme: "dark" } };
