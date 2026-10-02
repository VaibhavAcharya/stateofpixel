export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type CanvasView = { scale: number; x: number; y: number };

export const CANVAS_PADDING = 16;
export const CANVAS_PADDING_TOP = 80;
export const MAX_SCALE = 8;
export const ZOOM_STEP = 1.25;
export const ZOOM_OUT_LIMIT = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function room(viewportSize: number, start = CANVAS_PADDING) {
  return Math.max(1, viewportSize - start - CANVAS_PADDING);
}

export function fitScale(viewport: Size, content: Size) {
  return Math.min(1, room(viewport.width) / content.width);
}

function minScale(viewport: Size, content: Size) {
  return (
    Math.min(
      fitScale(viewport, content),
      room(viewport.height, CANVAS_PADDING_TOP) / content.height,
    ) / ZOOM_OUT_LIMIT
  );
}

export function fitView(viewport: Size, content: Size): CanvasView {
  return {
    scale: fitScale(viewport, content),
    x: CANVAS_PADDING,
    y: CANVAS_PADDING_TOP,
  };
}

function clampOffset(
  offset: number,
  viewportSize: number,
  size: number,
  start = CANVAS_PADDING,
) {
  return size + start + CANVAS_PADDING <= viewportSize
    ? start
    : clamp(offset, viewportSize - size - CANVAS_PADDING, start);
}

export function clampView(
  view: CanvasView,
  viewport: Size,
  content: Size,
): CanvasView {
  const scale = clamp(view.scale, minScale(viewport, content), MAX_SCALE);
  return {
    scale,
    x: clampOffset(view.x, viewport.width, content.width * scale),
    y: clampOffset(
      view.y,
      viewport.height,
      content.height * scale,
      CANVAS_PADDING_TOP,
    ),
  };
}

export function panView(
  view: CanvasView,
  delta: Point,
  viewport: Size,
  content: Size,
): CanvasView {
  return clampView(
    { ...view, x: view.x + delta.x, y: view.y + delta.y },
    viewport,
    content,
  );
}

export function zoomView(
  view: CanvasView,
  scale: number,
  anchor: Point,
  viewport: Size,
  content: Size,
): CanvasView {
  const next = clamp(scale, minScale(viewport, content), MAX_SCALE);
  const ratio = next / view.scale;
  return clampView(
    {
      scale: next,
      x: anchor.x - (anchor.x - view.x) * ratio,
      y: anchor.y - (anchor.y - view.y) * ratio,
    },
    viewport,
    content,
  );
}
