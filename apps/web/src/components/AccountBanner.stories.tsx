import type { Meta, StoryObj } from "@storybook/react-vite";
import { DAY_MS, STORY_NOW, storage, subscription } from "../lib/storyFixtures";
import { AccountBanner } from "./AccountBanner";

const meta = {
  title: "Account/Banner",
  component: AccountBanner,
  parameters: { backend: { "billing.available": true } },
  args: {
    owner: "acme",
    account: {
      type: "org",
      role: "owner",
      storage: storage("free", 8.5),
      subscription: null,
    },
  },
} satisfies Meta<typeof AccountBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StorageWarning: Story = {};

export const StorageWarningMember: Story = {
  args: { account: { ...meta.args.account, role: "member" } },
};

export const StorageWarningPersonalAccount: Story = {
  args: {
    owner: "octocat",
    account: { ...meta.args.account, type: "user", role: "member" },
  },
};

export const StorageWarningUnknownRole: Story = {
  args: { account: { ...meta.args.account, role: null } },
};

export const StorageWarningRepoAdmin: Story = {
  args: { repo: { name: "web", canAdmin: true } },
};

export const StorageWarningPaidPlan: Story = {
  args: {
    account: {
      ...meta.args.account,
      storage: storage("25gb", 21),
      subscription: subscription(),
    },
  },
};

export const StorageGrace: Story = {
  args: {
    account: { ...meta.args.account, storage: storage("free", 10.4, 3) },
  },
};

export const StorageBlocked: Story = {
  args: {
    account: { ...meta.args.account, storage: storage("free", 10.4, 20) },
  },
};

export const StorageBlockedWithoutBilling: Story = {
  parameters: { backend: { "billing.available": false } },
  args: StorageBlocked.args,
};

export const PaymentFailed: Story = {
  args: {
    account: {
      ...meta.args.account,
      storage: storage("25gb", 6),
      subscription: subscription({ status: "on_hold" }),
    },
  },
};

export const PaymentFailedMember: Story = {
  args: {
    account: {
      ...meta.args.account,
      role: "member",
      storage: storage("25gb", 6),
      subscription: subscription({ status: "past_due" }),
    },
  },
};

export const PlanEnds: Story = {
  args: {
    account: {
      ...meta.args.account,
      storage: storage("25gb", 4),
      subscription: subscription({
        cancelsAtPeriodEnd: true,
        periodEndsAt: STORY_NOW + 10 * DAY_MS,
      }),
    },
  },
};

const endsOverFreeLimit = {
  ...meta.args.account,
  storage: storage("100gb", 18),
  subscription: subscription({ cancelsAtPeriodEnd: true }),
};

export const PlanEndsOverFreeLimit: Story = {
  args: { account: endsOverFreeLimit },
};

export const PlanEndsMember: Story = {
  args: { account: { ...endsOverFreeLimit, role: "member" } },
};
