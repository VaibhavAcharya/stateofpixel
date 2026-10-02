import { describe, expect, it } from "vitest";
import {
  CANVAS_PADDING,
  clampView,
  fitView,
  MAX_SCALE,
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
      y: CANVAS_PADDING,
    });
  });

  it("never scales a small image up", () => {
    expect(fitView(viewport, small).scale).toBe(1);
  });
});

describe("panView", () => {
  it("stops at the image edges", () => {
    const view = fitView(viewport, wide);
    expect(panView(view, { x: 0, y: 500 }, viewport, wide).y).toBe(
      CANVAS_PADDING,
    );
    expect(panView(view, { x: 0, y: -5000 }, viewport, wide).y).toBe(
      viewport.height - 1500 - CANVAS_PADDING,
    );
  });

  it("keeps an image that fits at the top left", () => {
    const view = { scale: 1, x: CANVAS_PADDING, y: CANVAS_PADDING };
    expect(panView(view, { x: 200, y: -100 }, viewport, small)).toEqual(view);
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
    expect(zoomView(view, 0.01, anchor, viewport, wide).scale).toBe(0.1);
  });
});

describe("clampView", () => {
  it("fixes a view after the viewport grows", () => {
    const view = { scale: 0.8, x: -300, y: -900 };
    expect(clampView(view, { width: 2000, height: 2000 }, wide)).toEqual({
      scale: 0.8,
      x: CANVAS_PADDING,
      y: 2000 - 2400 - CANVAS_PADDING,
    });
  });
});
