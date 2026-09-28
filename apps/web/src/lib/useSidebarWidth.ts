import { type KeyboardEvent, type PointerEvent, useState } from "react";

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 480;
const KEY_STEP = 16;

function clamp(width: number) {
  const max = Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth / 2);
  return Math.round(Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), max));
}

export function useSidebarWidth() {
  const [width, setWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const left = handle.parentElement?.getBoundingClientRect().left ?? 0;
    handle.setPointerCapture(event.pointerId);
    setResizing(true);
    const onMove = (move: globalThis.PointerEvent) => {
      setWidth(clamp(move.clientX - left));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setResizing(false);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current =
      width ??
      event.currentTarget.parentElement?.getBoundingClientRect().width ??
      SIDEBAR_MIN_WIDTH;
    if (event.key === "ArrowLeft") setWidth(clamp(current - KEY_STEP));
    else if (event.key === "ArrowRight") setWidth(clamp(current + KEY_STEP));
    else if (event.key === "Home") setWidth(clamp(SIDEBAR_MIN_WIDTH));
    else if (event.key === "End") setWidth(clamp(SIDEBAR_MAX_WIDTH));
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return {
    width,
    resizing,
    handleProps: {
      onPointerDown,
      onKeyDown,
      onDoubleClick: () => setWidth(null),
    },
  };
}
