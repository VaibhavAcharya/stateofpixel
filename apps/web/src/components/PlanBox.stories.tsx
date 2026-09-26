import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { DAY_MS, STORY_NOW, storage, subscription } from "../lib/storyFixtures";
import { PlanBox } from "./PlanBox";

const meta = {
  title: "Account/Plan box",
  component: PlanBox,
  parameters: { convex: { "billing:available": true } },
  args: {
    login: "acme",
    accountType: "org",
    storage: storage("free", 3.2),
    subscription: null,
    billingCustomer: false,
    role: "owner",
    checkoutResult: null,
    onDismissCheckout: fn(),
  },
} satisfies Meta<typeof PlanBox>;

export default meta;

type Story = StoryObj<typeof meta>;

const paid = {
  storage: storage("25gb", 6.1),
  subscription: subscription(),
  billingCustomer: true,
};

const withMenuRoom = (Story: () => React.ReactNode) => (
  <div className="min-h-96">
    <Story />
  </div>
);

export const Free: Story = {};

export const FreeUpgradeMenu: Story = {
  decorators: [withMenuRoom],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Upgrade" }),
    );
  },
};

export const FreeMember: Story = {
  decorators: [withMenuRoom],
  args: { role: "member" },
  play: async ({ canvasElement }) => {
    within(canvasElement)
      .getByRole("button", { name: /Upgrade/ })
      .focus();
  },
};

export const FreePersonalMember: Story = {
  decorators: [withMenuRoom],
  args: { login: "octocat", accountType: "user", role: "member" },
  play: FreeMember.play,
};

export const BillingUnavailable: Story = {
  parameters: { convex: { "billing:available": false } },
};

export const Paid: Story = { args: paid };

export const PaidChangeMenu: Story = {
  decorators: [withMenuRoom],
  args: paid,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Change plan" }),
    );
  },
};

export const PaidMember: Story = { args: { ...paid, role: "member" } };

export const Cancelled: Story = {
  args: {
    ...paid,
    subscription: subscription({
      cancelsAtPeriodEnd: true,
      periodEndsAt: STORY_NOW + 10 * DAY_MS,
    }),
  },
};

export const RenewalFailed: Story = {
  args: { ...paid, subscription: subscription({ status: "on_hold" }) },
};

export const CheckoutSucceeded: Story = {
  args: {
    ...paid,
    checkoutResult: { subscriptionId: "sub_1", status: "succeeded" },
  },
};

export const CheckoutWaitingForPlan: Story = {
  args: { checkoutResult: { subscriptionId: "sub_1", status: "succeeded" } },
};

export const CheckoutProcessing: Story = {
  args: { checkoutResult: { subscriptionId: "sub_1", status: "processing" } },
};

export const CheckoutFailed: Story = {
  args: { checkoutResult: { subscriptionId: "sub_1", status: "failed" } },
};

export const ChangeCheckingPrice: Story = {
  args: paid,
  parameters: {
    billing: {
      change: {
        plan: "100gb",
        interval: "yearly",
        preview: null,
        submitted: false,
      },
    },
  },
};

export const ChangeConfirm: Story = {
  args: paid,
  parameters: {
    billing: {
      change: {
        plan: "100gb",
        interval: "monthly",
        preview: {
          amount: 1450,
          currency: "USD",
          renewsAt: STORY_NOW + 30 * DAY_MS,
        },
        submitted: false,
      },
    },
  },
};

export const ChangeConfirmNothingToPay: Story = {
  args: paid,
  parameters: {
    billing: {
      change: {
        plan: "25gb",
        interval: "yearly",
        preview: {
          amount: 0,
          currency: "USD",
          renewsAt: STORY_NOW + 365 * DAY_MS,
        },
        submitted: false,
      },
    },
  },
};

export const ChangeSubmitted: Story = {
  args: paid,
  parameters: {
    billing: {
      change: {
        plan: "100gb",
        interval: "monthly",
        preview: null,
        submitted: true,
      },
    },
  },
};

export const ChangeDone: Story = {
  args: { ...paid, storage: storage("100gb", 6.1) },
  parameters: ChangeSubmitted.parameters,
};

export const BillingError: Story = {
  args: paid,
  parameters: {
    billing: { error: "Could not open billing. Try again." },
  },
};
