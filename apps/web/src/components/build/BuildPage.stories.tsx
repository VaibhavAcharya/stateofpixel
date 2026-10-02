import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn, userEvent, within } from "storybook/test";
import { preloadDemoImages } from "../../lib/storyFixtures";
import { BuildPage } from "./BuildPage";
import { BuildDataContext } from "./buildData";
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

function fixture(browsers: string[]): BuildFixture {
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
      SNAPSHOTS.map((snapshot) => inBrowser(snapshot, browser, 1280)),
    ),
    reviewer: "octocat",
  };
}

function StoryBuild({ browsers }: { browsers: string[] }) {
  const [buildFixture] = useState(() => fixture(browsers));
  const { build, data } = useFixtureBuild(buildFixture);
  const [snapshotId, setSnapshotId] = useState<string>();
  return (
    <BuildDataContext.Provider
      value={{
        ...data,
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
