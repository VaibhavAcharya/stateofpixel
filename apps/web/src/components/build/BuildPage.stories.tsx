import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { preloadDemoImages } from "../../lib/storyFixtures";
import { BuildPage } from "./BuildPage";
import { type BuildData, BuildDataContext } from "./buildData";
import {
  type BuildFixture,
  changed,
  type FixtureSnapshot,
  unchanged,
  useFixtureBuild,
} from "./fixtureBuild";

function inBrowser(
  snapshot: FixtureSnapshot,
  browser: string,
  width: number,
): FixtureSnapshot {
  return {
    ...snapshot,
    id: `${snapshot.id}-${browser}`,
    name: `${snapshot.name} [${browser} ${width}]`,
    browser,
  };
}

const SNAPSHOTS = [
  changed("header", "Header/Default", 540),
  changed("pricing", "Pricing/Plans", 78),
  unchanged("footer", "Footer/Default", "/demo/header-base.png"),
];

const UNSTABLE = {
  ...changed("buttons", "Buttons/All", 1829, "approved"),
  unstable: true,
};

const ADDED: FixtureSnapshot = {
  id: "signin",
  name: "Auth/Sign in",
  diffStatus: "added",
  reviewState: "pending",
  image: "/demo/signin-new.png",
  baselineImage: null,
  diffImage: null,
};

const CHANGED_DELAY_MS = 300;

function fixture(
  browsers: string[],
  unstable: boolean,
  changes: boolean,
  added: boolean,
): BuildFixture {
  return {
    build: {
      number: 412,
      buildName: "default",
      branch: "feat/billing",
      baselineBranch: "main",
      commitSha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
      commitMessage: "Redesign the pricing and sign-in pages",
      prNumber: 88,
      prState: "open",
      status: "finalized",
      superseded: false,
      shards: { done: 1, total: 1 },
      autoApproved: false,
      storageBlocked: false,
      ciRunUrl: null,
      baseline: { number: 405, branch: "main" },
      supersededBy: null,
      mergedPr: null,
    },
    snapshots: browsers.flatMap((browser) =>
      [
        ...(unstable ? [UNSTABLE] : []),
        ...(added ? [ADDED] : []),
        ...SNAPSHOTS.filter(
          (snapshot) => changes || snapshot.diffStatus === "unchanged",
        ),
      ].map((snapshot) => inBrowser(snapshot, browser, 1280)),
    ),
    reviewer: "octocat",
  };
}

function StoryBuild({
  browsers,
  unstable = false,
  changes = true,
  added = false,
  changedLoadsLast = false,
}: {
  browsers: string[];
  unstable?: boolean;
  changes?: boolean;
  added?: boolean;
  changedLoadsLast?: boolean;
}) {
  const [buildFixture] = useState(() =>
    fixture(browsers, unstable, changes, added),
  );
  const { build, data } = useFixtureBuild(buildFixture);
  const [changedLoaded, setChangedLoaded] = useState(!changedLoadsLast);
  useEffect(() => {
    const timer = setTimeout(() => setChangedLoaded(true), CHANGED_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const [snapshotId, setSnapshotId] = useState<string>();
  const useSnapshotGroups: BuildData["useSnapshotGroups"] = (...args) => {
    const groups = data.useSnapshotGroups(...args);
    return changedLoaded
      ? groups
      : {
          ...groups,
          changed: {
            ...groups.changed,
            results: [],
            status: "LoadingFirstPage",
          },
        };
  };
  return (
    <BuildDataContext.Provider
      value={{
        ...data,
        useSnapshotGroups,
        useSelection: () => ({ snapshotId, select: setSnapshotId }),
      }}
    >
      <div className="flex h-screen flex-col">
        <BuildPage
          build={build}
          canWrite
          owner="acme"
          repo="web"
          links={false}
          keyboard={false}
          track={fn()}
        />
      </div>
    </BuildDataContext.Provider>
  );
}

const meta = {
  title: "Build/Page",
  component: StoryBuild,
  parameters: { layout: "fullscreen" },
  loaders: [preloadDemoImages],
  args: { browsers: ["chromium"] },
} satisfies Meta<typeof StoryBuild>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneBrowser: Story = {};

export const Browsers: Story = {
  args: { browsers: ["chromium", "firefox", "webkit"] },
};

export const BrowserMenu: Story = {
  args: { browsers: ["chromium", "firefox", "webkit"] },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Browser" }),
    );
  },
};

export const BrowserFiltered: Story = {
  args: { browsers: ["chromium", "firefox", "webkit"] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Browser" }));
    await userEvent.click(
      canvas.getByRole("menuitemradio", { name: "firefox" }),
    );
  },
};

export const Unstable: Story = {
  args: { unstable: true },
};

export const UnstableOpen: Story = {
  args: { unstable: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Unstable/ }),
    );
  },
};

export const OnlyUnstableChanges: Story = {
  args: { unstable: true, changes: false },
};

export const ChangedLoadsLast: Story = {
  args: { added: true, changedLoadsLast: true },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement
          .querySelector('[aria-current="true"]')
          ?.getAttribute("aria-label"),
      ).toMatch(/^Header\/Default/),
    );
  },
};
