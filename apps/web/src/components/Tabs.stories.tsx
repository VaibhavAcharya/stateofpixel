import {
  CreditCardIcon,
  GearIcon,
  ImagesIcon,
  SquaresFourIcon,
  StackIcon,
  UsersIcon,
} from "@phosphor-icons/react/ssr";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tab, Tabs } from "./Tabs";

const meta = {
  title: "App/Tabs",
  component: Tabs,
  args: { children: null },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

const account = { owner: "acme" };
const project = { owner: "acme", repo: "web" };

export const Account: Story = {
  render: () => (
    <Tabs>
      <Tab
        to="/$owner"
        params={account}
        icon={SquaresFourIcon}
        label="Projects"
        active
      />
      <Tab
        to="/$owner/settings/members"
        params={account}
        icon={UsersIcon}
        label="Members"
        active={false}
      />
      <Tab
        to="/$owner/settings/billing"
        params={account}
        icon={CreditCardIcon}
        label="Billing"
        active={false}
      />
    </Tabs>
  ),
};

function ProjectTabs({ settingsLocked }: { settingsLocked: boolean }) {
  return (
    <Tabs>
      <Tab
        to="/$owner/$repo"
        params={project}
        icon={StackIcon}
        label="Builds"
        active
      />
      <Tab
        to="/$owner/$repo/baselines"
        params={project}
        icon={ImagesIcon}
        label="Baselines"
        active={false}
      />
      <Tab
        to="/$owner/$repo/settings"
        params={project}
        icon={GearIcon}
        label="Settings"
        active={false}
        disabledReason={
          settingsLocked
            ? "Only admins of this repository on GitHub can change its settings."
            : undefined
        }
      />
    </Tabs>
  );
}

export const Project: Story = {
  render: () => <ProjectTabs settingsLocked={false} />,
};

export const ProjectSettingsLocked: Story = {
  decorators: [
    (Story) => (
      <div className="min-h-32">
        <Story />
      </div>
    ),
  ],
  render: () => <ProjectTabs settingsLocked />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>("button")?.focus();
  },
};
