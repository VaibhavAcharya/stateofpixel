import type { Id } from "@stateofpixel/backend/dataModel";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  build,
  DAY_MS,
  demoImage,
  preloadDemoImages,
  STORY_NOW,
} from "../../lib/storyFixtures";
import { useViewerSettings } from "../Viewer";
import { type BuildData, BuildDataContext } from "./buildData";
import { SnapshotDetail } from "./SnapshotDetail";
import type { Snapshot } from "./types";

const pending: Snapshot = {
  id: "snapshot_1" as Id<"snapshots">,
  buildId: build.buildId,
  name: "Pricing/Plans [chromium 1280]",
  diffStatus: "changed",
  reviewState: "pending",
  diffRatio: 78 / (600 * 375),
  diffPixels: 78,
  metadata: {},
  image: demoImage("pricing-new"),
  baselineImage: demoImage("pricing-base"),
  diffImage: demoImage("pricing-diff"),
  lastReview: null,
  comments: [],
  rejectedIn: null,
  notReviewedOnPr: false,
  history: [],
  flaky: null,
};

const review: NonNullable<Snapshot["lastReview"]> = {
  action: "approve",
  source: "user",
  login: "octocat",
  comment: null,
  createdAt: STORY_NOW - 2 * 60 * 60 * 1000,
  carriedFrom: null,
};

function StoryDetail({
  snapshot,
  canWrite = true,
  commenting = false,
}: {
  snapshot: Snapshot | null | undefined;
  canWrite?: boolean;
  commenting?: boolean;
}) {
  const settings = useViewerSettings();
  const data: BuildData = {
    useSnapshotGroups: () => {
      throw new Error("not used");
    },
    useSnapshot: () => snapshot,
    useApplyReview: () => async () => {},
    useAddComment: () => async () => {},
    useSelection: () => {
      throw new Error("not used");
    },
  };
  return (
    <BuildDataContext.Provider value={data}>
      <div className="flex h-[720px] flex-col bg-surface">
        <SnapshotDetail
          owner="acme"
          repo="web"
          build={build}
          snapshotId={pending.id}
          settings={settings}
          canReview={canWrite}
          onApprove={fn()}
          onReject={fn()}
          commenting={commenting}
          onOpenComments={fn()}
          onCloseComments={fn()}
          onComment={fn()}
          onUndo={fn()}
          onPrevious={fn()}
          onNext={fn()}
          navigation={null}
        />
      </div>
    </BuildDataContext.Provider>
  );
}

const meta = {
  title: "Build/Snapshot detail",
  component: StoryDetail,
  parameters: { layout: "fullscreen" },
  loaders: [preloadDemoImages],
  args: { snapshot: pending },
} satisfies Meta<typeof StoryDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const PendingDark: Story = { parameters: { theme: "dark" } };

export const Approved: Story = {
  args: {
    snapshot: { ...pending, reviewState: "approved", lastReview: review },
  },
};

export const RejectedWithComment: Story = {
  args: {
    snapshot: {
      ...pending,
      reviewState: "rejected",
      lastReview: {
        ...review,
        action: "reject",
        comment: "The Pro card lost its border.",
      },
    },
  },
};

export const CommentsFromTwoReviewers: Story = {
  args: {
    commenting: true,
    snapshot: {
      ...pending,
      reviewState: "rejected",
      lastReview: {
        ...review,
        action: "reject",
        login: "hubot",
        comment: "The Pro card lost its border.",
      },
      comments: [
        {
          id: "review_1",
          action: null,
          login: "octocat",
          body: "The new spacing matches the design file.",
          createdAt: STORY_NOW - 3 * 60 * 60 * 1000,
        },
        {
          id: "review_2",
          action: "reject",
          login: "hubot",
          body: "The Pro card lost its border.",
          createdAt: STORY_NOW - 20 * 60 * 1000,
        },
      ],
    },
  },
};

export const CarriedOver: Story = {
  args: {
    snapshot: {
      ...pending,
      reviewState: "approved",
      lastReview: {
        ...review,
        source: "carry_over",
        carriedFrom: { buildNumber: 409, login: "octocat" },
      },
    },
  },
};

export const ApprovedAutomatically: Story = {
  args: {
    snapshot: {
      ...pending,
      reviewState: "approved",
      lastReview: { ...review, source: "auto_branch", login: null },
      notReviewedOnPr: true,
    },
  },
};

export const FirstBaseline: Story = {
  args: {
    snapshot: {
      ...pending,
      diffStatus: "added",
      reviewState: "approved",
      baselineImage: null,
      diffImage: null,
      diffRatio: null,
      diffPixels: null,
      lastReview: { ...review, source: "orphan", login: null },
    },
  },
};

export const RejectedInEarlierBuild: Story = {
  args: { snapshot: { ...pending, rejectedIn: 409 } },
};

export const WithoutWriteAccess: Story = { args: { canWrite: false } };

export const Unchanged: Story = {
  args: {
    snapshot: {
      ...pending,
      diffStatus: "unchanged",
      reviewState: "none",
      image: demoImage("pricing-base"),
      diffImage: null,
      diffRatio: null,
      diffPixels: null,
    },
  },
};

export const Removed: Story = {
  args: {
    snapshot: {
      ...pending,
      diffStatus: "removed",
      reviewState: "none",
      image: null,
      diffImage: null,
      diffRatio: null,
      diffPixels: null,
    },
  },
};

export const NotStored: Story = {
  args: {
    snapshot: {
      ...pending,
      reviewState: "none",
      image: null,
      diffImage: null,
      diffRatio: null,
      diffPixels: null,
    },
  },
};

export const Failed: Story = {
  args: {
    snapshot: {
      ...pending,
      diffStatus: "failed",
      reviewState: "none",
      diffImage: null,
      diffRatio: null,
      diffPixels: null,
    },
  },
};

export const WithHistoryAndDetails: Story = {
  args: {
    snapshot: {
      ...pending,
      history: [405, 398, 371],
      metadata: {
        browser: "chromium",
        viewport: 1280,
        storyId: "pricing--plans",
        importPath: "./src/Pricing.stories.tsx",
      },
    },
  },
};

export const LooksFlaky: Story = {
  args: {
    snapshot: {
      ...pending,
      history: [405, 398, 371],
      flaky: { flips: 3, builds: 10, sameCommitBuild: null },
    },
  },
};

export const LooksFlakyOnTheSameCommit: Story = {
  args: {
    snapshot: {
      ...pending,
      flaky: { flips: 0, builds: 1, sameCommitBuild: 410 },
    },
  },
};

export const Loading: Story = { args: { snapshot: undefined } };

export const NotFound: Story = { args: { snapshot: null } };

export const OldSnapshot: Story = {
  args: {
    snapshot: {
      ...pending,
      reviewState: "approved",
      lastReview: { ...review, createdAt: STORY_NOW - 40 * DAY_MS },
    },
  },
};
