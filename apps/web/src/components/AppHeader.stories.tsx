import { KeyboardIcon } from "@phosphor-icons/react/ssr";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { avatar, withMenuRoom } from "../lib/storyFixtures";
import { AppHeader } from "./AppHeader";
import { buttonClass } from "./ui";

const meta = {
  title: "App/Header",
  component: AppHeader,
  parameters: {
    layout: "fullscreen",
    backend: {
      "me.accounts": [
        { login: "octocat", type: "user", installed: true, plan: "free" },
        { login: "acme", type: "org", installed: true, plan: "100gb" },
        {
          login: "a-very-long-organization-name",
          type: "org",
          installed: true,
          plan: "25gb",
        },
      ],
      "me.installUrl": "https://github.com/apps/stateofpixel/installations/new",
      "users.viewer": {
        login: "octocat",
        name: "Mona Octocat",
        image: avatar("octocat"),
      },
    },
  },
  args: { owner: "acme" },
} satisfies Meta<typeof AppHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Account: Story = {};

export const Project: Story = { args: { repo: "web" } };

export const ProjectDark: Story = {
  args: { repo: "web" },
  parameters: { theme: "dark" },
};

export const AllProjects: Story = {
  args: { owner: undefined },
  parameters: { path: "/install" },
};

export const WithActions: Story = {
  args: {
    repo: "web",
    actions: (
      <button
        type="button"
        aria-label="Keyboard shortcuts"
        className={buttonClass("ghost", "icon")}
      >
        <KeyboardIcon size={18} />
      </button>
    ),
  },
};

export const AccountSwitcherOpen: Story = {
  decorators: [withMenuRoom],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Switch account" }),
    );
  },
};

export const UserMenuOpen: Story = {
  decorators: [withMenuRoom],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Account menu" }),
    );
  },
};

export const UserMenuOnAllProjects: Story = {
  ...UserMenuOpen,
  args: { owner: undefined },
  parameters: { path: "/install" },
};
