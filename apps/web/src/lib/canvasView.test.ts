import { describe, expect, it } from "vitest";
import {
  CANVAS_PADDING,
  CANVAS_PADDING_TOP,
  clampView,
  fitView,
  MAX_SCALE,
  PAN_MARGIN,
  panView,
  zoomView,
} from "./canvasView";

const viewport = { width: 832, height: 632 };
const wide = { width: 1600, height: 3000 };
const small = { width: 400, height: 300 };

describe("fitView", () => {
  it("fits the width of a wide image", () => {
    expect(fitView(viewport, wide)).toEqual({
      scale: 0.5,
      x: CANVAS_PADDING,
      y: CANVAS_PADDING_TOP,
    });
  });

  it("never scales a small image up", () => {
    expect(fitView(viewport, small).scale).toBe(1);
  });

  it("centers an image that fits below the top padding", () => {
    expect(fitView(viewport, small)).toEqual({
      scale: 1,
      x: (viewport.width - small.width) / 2,
      y:
        CANVAS_PADDING_TOP +
        (viewport.height - CANVAS_PADDING_TOP - CANVAS_PADDING - small.height) /
          2,
    });
  });
});

describe("panView", () => {
  it("stops when only the margin of the image is on screen", () => {
    const view = fitView(viewport, wide);
    expect(panView(view, { x: 0, y: 5000 }, viewport, wide).y).toBe(
      viewport.height - PAN_MARGIN,
    );
    expect(panView(view, { x: 0, y: -5000 }, viewport, wide).y).toBe(
      PAN_MARGIN - 1500,
    );
  });

  it("pans an image that fits", () => {
    const view = fitView(viewport, small);
    expect(panView(view, { x: 200, y: -100 }, viewport, small)).toEqual({
      scale: 1,
      x: view.x + 200,
      y: view.y - 100,
    });
  });
});

describe("zoomView", () => {
  it("keeps the anchor point under the pointer", () => {
    const view = { scale: 1, x: -100, y: -200 };
    const anchor = { x: 300, y: 250 };
    const next = zoomView(view, 2, anchor, viewport, wide);
    expect((anchor.x - next.x) / next.scale).toBe(
      (anchor.x - view.x) / view.scale,
    );
    expect((anchor.y - next.y) / next.scale).toBe(
      (anchor.y - view.y) / view.scale,
    );
  });

  it("limits the scale between half the whole image and the maximum", () => {
    const view = fitView(viewport, wide);
    const anchor = { x: 0, y: 0 };
    expect(zoomView(view, 100, anchor, viewport, wide).scale).toBe(MAX_SCALE);
    expect(zoomView(view, 0.01, anchor, viewport, wide).scale).toBeCloseTo(
      0.089,
    );
  });
});

describe("clampView", () => {
  it("brings back an image panned off screen", () => {
    const view = { scale: 1, x: 5000, y: -5000 };
    expect(clampView(view, viewport, small)).toEqual({
      scale: 1,
      x: viewport.width - PAN_MARGIN,
      y: PAN_MARGIN - small.height,
    });
  });
});
