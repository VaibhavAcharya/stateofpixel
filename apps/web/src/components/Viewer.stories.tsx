import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CANVAS_PADDING, type CanvasView } from "../lib/canvasView";
import { demoImage, preloadDemoImages } from "../lib/storyFixtures";
import {
  type DiffColor,
  useViewerSettings,
  Viewer,
  type ViewerMode,
  type ViewerSnapshot,
} from "./Viewer";

type Initial = {
  mode?: ViewerMode;
  view?: CanvasView;
  sideDiff?: boolean;
  showBaseline?: boolean;
  diffOnly?: boolean;
  diffColor?: DiffColor;
};

function StoryViewer({
  snapshot,
  initial = {},
}: {
  snapshot: ViewerSnapshot;
  initial?: Initial;
}) {
  const settings = useViewerSettings();
  const [mode, setMode] = useState(initial.mode ?? settings.mode);
  const [view, setView] = useState(initial.view ?? settings.view);
  const [sideDiff, setSideDiff] = useState(initial.sideDiff ?? true);
  const [showBaseline, setShowBaseline] = useState(
    initial.showBaseline ?? false,
  );
  const [diffOnly, setDiffOnly] = useState(initial.diffOnly ?? false);
  const [diffColor, setDiffColor] = useState(initial.diffColor ?? "red");
  return (
    <div className="flex h-[720px] flex-col bg-surface">
      <Viewer
        snapshot={snapshot}
        settings={{
          ...settings,
          mode,
          setMode,
          view,
          setView,
          sideDiff,
          setSideDiff,
          showBaseline,
          setShowBaseline,
          diffOnly,
          setDiffOnly,
          diffColor,
          setDiffColor,
        }}
        baselineLabel="Baseline #405"
        newLabel="New #412"
        navigation={null}
      />
    </div>
  );
}

const changed: ViewerSnapshot = {
  name: "Header/Default [chromium 1280]",
  diffStatus: "changed",
  diffRatio: 540 / (600 * 375),
  diffPixels: 540,
  image: demoImage("header-new"),
  baselineImage: demoImage("header-base"),
  diffImage: demoImage("header-diff"),
};

const meta = {
  title: "Build/Viewer",
  component: StoryViewer,
  parameters: { layout: "fullscreen" },
  loaders: [preloadDemoImages],
  args: { snapshot: changed },
} satisfies Meta<typeof StoryViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SideBySide: Story = {};

export const SideBySideDark: Story = { parameters: { theme: "dark" } };

export const SideBySideWithoutOverlay: Story = {
  args: { initial: { sideDiff: false } },
};

export const SideBySideBlueOverlay: Story = {
  args: { initial: { diffColor: "blue" } },
};

export const SideBySideGreenOverlayDark: Story = {
  args: { initial: { diffColor: "green" } },
  parameters: { theme: "dark" },
};

export const Diff: Story = { args: { initial: { mode: "diff" } } };

export const DiffOnly: Story = {
  args: { initial: { mode: "diff", diffOnly: true } },
};

export const DiffOnlyMagenta: Story = {
  args: { initial: { mode: "diff", diffOnly: true, diffColor: "magenta" } },
};

export const Slider: Story = { args: { initial: { mode: "slider" } } };

export const Flip: Story = { args: { initial: { mode: "flip" } } };

export const FlipShowingBaseline: Story = {
  args: { initial: { mode: "flip", showBaseline: true } },
};

const zoomed = (scale: number) => ({
  initial: { view: { scale, x: CANVAS_PADDING, y: CANVAS_PADDING } },
});

export const ActualSize: Story = { args: zoomed(1) };

export const DoubleSize: Story = { args: zoomed(2) };

export const Panned: Story = {
  args: { initial: { view: { scale: 4, x: -600, y: -300 } } },
};

export const SizeChanged: Story = {
  args: {
    snapshot: {
      ...changed,
      baselineImage: { ...demoImage("header-base"), height: 320 },
    },
  },
};

export const Added: Story = {
  args: {
    snapshot: {
      name: "Invoices/Empty [chromium 1280]",
      diffStatus: "added",
      diffRatio: null,
      diffPixels: null,
      image: demoImage("invoices-new"),
      baselineImage: null,
      diffImage: null,
    },
  },
};

export const Removed: Story = {
  args: {
    snapshot: {
      name: "Settings/Legacy [chromium 1280]",
      diffStatus: "removed",
      diffRatio: null,
      diffPixels: null,
      image: null,
      baselineImage: demoImage("header-base"),
      diffImage: null,
    },
  },
};

export const Unchanged: Story = {
  args: {
    snapshot: {
      name: "Pricing/Free [chromium 1280]",
      diffStatus: "unchanged",
      diffRatio: null,
      diffPixels: null,
      image: demoImage("pricing-base"),
      baselineImage: demoImage("pricing-base"),
      diffImage: null,
    },
  },
};
