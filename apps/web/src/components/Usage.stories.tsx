import type { Meta, StoryObj } from "@storybook/react-vite";
import { DAY_MS, STORY_NOW, storage } from "../lib/storyFixtures";
import { USAGE_DAYS, UsageView } from "./Usage";

const MEGABYTE = 1024 ** 2;

const daily = Array.from({ length: USAGE_DAYS - 20 }, (_, index) => ({
  day: new Date(STORY_NOW - (USAGE_DAYS - 21 - index) * DAY_MS)
    .toISOString()
    .slice(0, 10),
  bytes: (1800 + index * 15 + (index % 7) * 40) * MEGABYTE,
}));

const meta = {
  title: "Account/Usage",
  component: UsageView,
  args: {
    owner: "acme",
    today: STORY_NOW,
    usage: {
      storage: storage("free", 3.2),
      countedOn: daily[daily.length - 1]?.day ?? null,
      daily,
      projects: [
        {
          name: "web-app",
          private: true,
          archived: false,
          prRetentionDays: 60,
          baselineBytes: 1400 * MEGABYTE,
          prBytes: 900 * MEGABYTE,
          diffBytes: 120 * MEGABYTE,
        },
        {
          name: "design-system",
          private: false,
          archived: false,
          prRetentionDays: 30,
          baselineBytes: 520 * MEGABYTE,
          prBytes: 210 * MEGABYTE,
          diffBytes: 40 * MEGABYTE,
        },
        {
          name: "old-site",
          private: true,
          archived: true,
          prRetentionDays: 60,
          baselineBytes: 12 * MEGABYTE,
          prBytes: 0,
          diffBytes: 0,
        },
      ],
    },
  },
} satisfies Meta<typeof UsageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NotCountedYet: Story = {
  args: {
    usage: {
      storage: storage("free", 0.4),
      countedOn: null,
      daily: [],
      projects: [],
    },
  },
};
