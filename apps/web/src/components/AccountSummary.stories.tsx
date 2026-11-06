import type { Meta, StoryObj } from "@storybook/react-vite";
import { storage } from "../lib/storyFixtures";
import { AccountSummary } from "./AccountSummary";

const meta = {
  title: "Account/Summary",
  component: AccountSummary,
  parameters: {
    backend: {
      "accounts.home": {
        login: "acme",
        type: "org",
        installationSettingsUrl: null,
        storage: storage("free", 3.2),
        subscription: null,
        billingCustomer: false,
        role: "member",
      },
      "members.list": [
        {
          login: "octocat",
          name: null,
          image: null,
          role: "owner",
          lastSeenAt: 0,
        },
        {
          login: "hubot",
          name: null,
          image: null,
          role: "member",
          lastSeenAt: 0,
        },
      ],
    },
  },
  args: { owner: "acme" },
} satisfies Meta<typeof AccountSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { parameters: { theme: "dark" } };
