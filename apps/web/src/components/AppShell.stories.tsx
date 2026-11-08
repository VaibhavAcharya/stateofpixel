import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { avatar, STORY_NOW, storage } from "../lib/storyFixtures";
import { AccountLayout } from "./AccountLayout";
import { AccountSummary } from "./AccountSummary";
import { AppShell } from "./AppShell";
import { ListToolbar, SearchField } from "./ListControls";
import { Page } from "./Page";
import { ProjectHeader } from "./ProjectHeader";
import { ProjectTable } from "./ProjectTable";
import { SkeletonRows } from "./ui";

const HOUR_MS = 60 * 60 * 1000;

const counts = {
  unchanged: 40,
  changed: 3,
  added: 1,
  removed: 0,
  failed: 0,
  pending: 4,
  approved: 0,
  rejected: 0,
};

function project(name: string, fields: Record<string, unknown>) {
  return {
    owner: "acme",
    name,
    private: false,
    latestBuild: {
      number: 88,
      branch: "main",
      status: "finalized",
      conclusion: "approved",
      counts,
      storageBlocked: false,
      createdAt: STORY_NOW - 30 * HOUR_MS,
      ...fields,
    },
  };
}

const projects = [
  project("design-system", {}),
  project("docs", {
    number: 19,
    branch: "fix/sidebar",
    conclusion: "rejected",
    counts: { ...counts, rejected: 1 },
    createdAt: STORY_NOW - 5 * HOUR_MS,
  }),
  project("mobile", {
    number: 33,
    storageBlocked: true,
    conclusion: "changes",
  }),
  project("web", {
    number: 412,
    branch: "feat/billing",
    conclusion: "changes",
    createdAt: STORY_NOW - 2 * HOUR_MS,
  }),
];

const backend = {
  "me.accounts": [
    { login: "octocat", type: "user", installed: true, plan: "free" },
    { login: "acme", type: "org", installed: true, plan: "100gb" },
  ],
  "me.installUrl": "https://github.com/apps/stateofpixel/installations/new",
  "users.viewer": {
    login: "octocat",
    name: "Mona Octocat",
    image: avatar("octocat"),
  },
  "accounts.home": {
    login: "acme",
    type: "org",
    installationSettingsUrl: "https://github.com/organizations/acme/settings",
    storage: storage("100gb", 41.6),
    subscription: null,
    billingCustomer: false,
    role: "owner",
  },
  "members.list": [
    { login: "octocat", name: null, image: null, role: "owner", lastSeenAt: 0 },
    { login: "hubot", name: null, image: null, role: "member", lastSeenAt: 0 },
  ],
  "accounts.projects": {
    pages: [{ page: projects, isDone: true, continueCursor: "4" }],
    pageParams: [{ numItems: 12, cursor: null }],
  },
  "projects.access": {
    permission: "admin",
    canWrite: true,
    canAdmin: true,
    account: null,
  },
};

function AccountOverview() {
  return (
    <AppShell owner="acme">
      <AccountLayout owner="acme" tab="projects">
        <AccountSummary owner="acme" />
        <ListToolbar>
          <SearchField value="" onChange={fn()} placeholder="Search projects" />
        </ListToolbar>
        <ProjectTable
          login="acme"
          search={{}}
          onSearchChange={fn()}
          empty="No repositories yet."
        />
      </AccountLayout>
    </AppShell>
  );
}

function ProjectBuilds() {
  return (
    <AppShell owner="acme" repo="web">
      <Page>
        <ProjectHeader owner="acme" repo="web" tab="builds" />
        <SkeletonRows />
      </Page>
    </AppShell>
  );
}

function Accounts() {
  return (
    <AppShell>
      <Page>
        <SkeletonRows rows={2} />
      </Page>
    </AppShell>
  );
}

const meta = {
  title: "App/Shell",
  component: AccountOverview,
  parameters: { layout: "fullscreen", backend, path: "/acme" },
} satisfies Meta<typeof AccountOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Account: Story = {};

export const AccountDark: Story = { parameters: { theme: "dark" } };

export const AccountMobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

export const Project: Story = {
  render: () => <ProjectBuilds />,
  parameters: { path: "/acme/web" },
};

export const AllAccounts: Story = {
  render: () => <Accounts />,
  parameters: { path: "/install" },
};

export const Collapsed: Story = {
  render: () => (
    <AppShell owner="acme" repo="web" crumb="#412" fullHeight>
      <div className="flex-1 bg-canvas" />
    </AppShell>
  ),
  parameters: { path: "/acme/web/builds/412" },
};

export const AccountSwitcherOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Switch account" }),
    );
  },
};

export const UserMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Account menu" }),
    );
  },
};
