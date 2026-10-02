import {
  ArrowsLeftRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CircleHalfIcon,
  MinusIcon,
  PlusIcon,
  SquareSplitHorizontalIcon,
  SwapIcon,
} from "@phosphor-icons/react/ssr";
import {
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  CANVAS_PADDING,
  type CanvasView,
  clampView,
  fitView,
  type Point,
  panView,
  type Size,
  ZOOM_STEP,
  zoomView,
} from "../lib/canvasView";
import { formatCount, formatPercent } from "../lib/format";
import {
  buttonClass,
  type DiffStatus,
  DiffStatusPill,
  type Icon,
  Kbd,
  SnapshotImage,
  SnapshotName,
  Tooltip,
} from "./ui";

export type ViewerMode = "side" | "diff" | "slider" | "flip";
export type ViewerZoom = { by: number } | { to: number };

type Image = { url: string; width: number; height: number };

export type ViewerSnapshot = {
  name: string;
  diffStatus: DiffStatus;
  diffRatio: number | null;
  diffPixels: number | null;
  image: Image | null;
  baselineImage: Image | null;
  diffImage: Image | null;
};

export const MODES: {
  value: ViewerMode;
  label: string;
  shortLabel: string;
  icon: Icon;
  key: string;
}[] = [
  {
    value: "side",
    label: "Side by side",
    shortLabel: "Side",
    icon: SquareSplitHorizontalIcon,
    key: "1",
  },
  {
    value: "diff",
    label: "Diff",
    shortLabel: "Diff",
    icon: CircleHalfIcon,
    key: "2",
  },
  {
    value: "slider",
    label: "Slider",
    shortLabel: "Slider",
    icon: ArrowsLeftRightIcon,
    key: "3",
  },
  {
    value: "flip",
    label: "Flip",
    shortLabel: "Flip",
    icon: SwapIcon,
    key: "4",
  },
];

export type DiffColor = "red" | "magenta" | "blue" | "green";

export const DIFF_COLORS: { value: DiffColor; label: string; color: string }[] =
  [
    { value: "magenta", label: "Magenta", color: "#ff00ff" },
    { value: "green", label: "Green", color: "#00cc00" },
    { value: "red", label: "Red", color: "#ff0000" },
    { value: "blue", label: "Blue", color: "#0066ff" },
  ];

export function useViewerSettings() {
  const [mode, setMode] = useState<ViewerMode>("side");
  const [view, setView] = useState<CanvasView | null>(null);
  const zoomTo = useRef<(zoom: ViewerZoom) => void>(() => {});
  const [sideDiff, setSideDiff] = useState(true);
  const [showBaseline, setShowBaseline] = useState(false);
  const [diffOnly, setDiffOnly] = useState(false);
  const [diffColor, setDiffColor] = useState<DiffColor>("magenta");
  return {
    sideDiff,
    setSideDiff,
    mode,
    setMode,
    view,
    setView,
    zoomTo,
    zoom: (zoom: ViewerZoom) => zoomTo.current(zoom),
    showBaseline,
    setShowBaseline,
    diffOnly,
    setDiffOnly,
    diffColor,
    setDiffColor,
  };
}

export type ViewerSettings = ReturnType<typeof useViewerSettings>;

export function Viewer({
  snapshot,
  baselineLabel,
  newLabel,
  settings,
  navigation,
  headings = true,
}: {
  snapshot: ViewerSnapshot;
  baselineLabel: string;
  newLabel: string;
  settings: ViewerSettings;
  navigation: ReactNode;
  headings?: boolean;
}) {
  const Title = headings ? "h2" : "p";
  const { mode, setMode } = settings;
  const { image, baselineImage } = snapshot;
  const single = image === null || baselineImage === null;
  const overlayShown =
    !single &&
    snapshot.diffImage !== null &&
    (mode === "diff" || (mode === "side" && settings.sideDiff));
  const canvas = useCanvas(settings, contentSize(snapshot, mode, single));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DiffColorFilters />
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
        <Title
          className="min-w-0 text-base font-medium max-sm:w-full"
          title={snapshot.name}
        >
          <SnapshotName name={snapshot.name} />
        </Title>
        <DiffStatusPill status={snapshot.diffStatus} />
        {snapshot.diffRatio !== null && (
          <span className="text-xs whitespace-nowrap text-muted tabular-nums">
            {formatPercent(snapshot.diffRatio)}
            {snapshot.diffPixels !== null &&
              ` / ${formatCount(snapshot.diffPixels)} px`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Dimensions baseline={baselineImage} image={image} />
          {navigation}
        </div>
      </div>
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-1.5">
        {!single && (
          <div className="flex min-w-0 flex-wrap items-center rounded-control bg-surface-2 p-0.5">
            <Segmented
              label="View mode"
              options={MODES}
              value={mode}
              onChange={setMode}
            />
            <ModeSwitch settings={settings} snapshot={snapshot} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {overlayShown && (
            <DiffColorStack
              value={settings.diffColor}
              onChange={settings.setDiffColor}
            />
          )}
        </div>
      </div>
      <div className="group/stage relative flex min-h-0 flex-1 flex-col">
        <ZoomControls settings={settings} scale={canvas.view.scale} />
        <div
          ref={canvas.stageRef}
          className={`grid min-h-0 flex-1 overflow-hidden bg-border select-none ${
            canvas.pannable
              ? `touch-none ${canvas.panning ? "cursor-grabbing" : "cursor-grab"}`
              : "touch-pan-x touch-pan-y"
          } ${
            single || mode !== "side"
              ? "grid-cols-1"
              : "grid-cols-2 gap-px max-md:grid-cols-1 max-md:grid-rows-2"
          }`}
        >
          {single ? (
            <Pane
              caption={image === null ? baselineLabel : newLabel}
              view={canvas.view}
              paneRef={canvas.paneRef}
            >
              <Frame
                image={image ?? baselineImage}
                scale={canvas.view.scale}
                caption={image === null ? baselineLabel : newLabel}
              />
            </Pane>
          ) : (
            <Compare
              settings={settings}
              snapshot={snapshot}
              image={image}
              baselineImage={baselineImage}
              baselineLabel={baselineLabel}
              newLabel={newLabel}
              view={canvas.view}
              paneRef={canvas.paneRef}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ZoomControls({
  settings,
  scale,
}: {
  settings: ViewerSettings;
  scale: number;
}) {
  const button = `${buttonClass("ghost", "sm")} h-5 w-full rounded-[5px] px-0`;
  const tooltip = "top-1/2! right-full! left-auto! mt-0! mr-2 -translate-y-1/2";
  return (
    <div className="absolute right-2 bottom-2 z-10 flex w-9 flex-col rounded-md bg-surface p-0.5 opacity-0 shadow-menu ring-1 ring-border transition-opacity duration-150 group-hover/stage:opacity-100 focus-within:opacity-100 motion-reduce:transition-none pointer-coarse:hidden">
      <Tooltip label="Zoom in, press +" className={tooltip}>
        <button
          type="button"
          aria-label="Zoom in"
          className={button}
          onClick={() => settings.zoom({ by: ZOOM_STEP })}
        >
          <PlusIcon size={10} weight="bold" />
        </button>
      </Tooltip>
      <Tooltip label="Real pixels, press 0" className={tooltip}>
        <button
          type="button"
          aria-label={`Zoom ${Math.round(scale * 100)}%, show at 100%`}
          className={`${button} text-[9px] tabular-nums`}
          onClick={() => settings.zoom({ to: 1 })}
        >
          {Math.round(scale * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom out, press -" className={tooltip}>
        <button
          type="button"
          aria-label="Zoom out"
          className={button}
          onClick={() => settings.zoom({ by: 1 / ZOOM_STEP })}
        >
          <MinusIcon size={10} weight="bold" />
        </button>
      </Tooltip>
      <span aria-hidden className="mx-1 my-0.5 h-px bg-border" />
      <Tooltip label="Fit, press f" className={tooltip}>
        <button
          type="button"
          className={`${button} text-[9px]`}
          disabled={settings.view === null}
          onClick={() => settings.setView(null)}
        >
          Fit
        </button>
      </Tooltip>
    </div>
  );
}

function Dimensions({
  baseline,
  image,
}: {
  baseline: Image | null;
  image: Image | null;
}) {
  const format = (value: Image) => `${value.width}x${value.height}`;
  if (image === null && baseline === null) {
    return null;
  }
  const differs =
    baseline !== null &&
    image !== null &&
    (baseline.width !== image.width || baseline.height !== image.height);
  return (
    <span className="shrink-0 text-xs text-muted tabular-nums max-sm:hidden">
      {differs ? (
        <>
          {format(baseline)} to{" "}
          <span className="text-changed">{format(image)}</span>
        </>
      ) : (
        format((image ?? baseline) as Image)
      )}
    </span>
  );
}

function modeSwitch(settings: ViewerSettings, snapshot: ViewerSnapshot) {
  if (settings.mode === "side" && snapshot.diffImage !== null) {
    return {
      label: "Diff overlay",
      key: "d",
      on: settings.sideDiff,
      toggle: () => settings.setSideDiff(!settings.sideDiff),
    };
  }
  if (settings.mode === "diff" && snapshot.diffImage !== null) {
    return {
      label: "Diff only",
      key: "d",
      on: settings.diffOnly,
      toggle: () => settings.setDiffOnly(!settings.diffOnly),
    };
  }
  if (settings.mode === "flip") {
    return {
      label: "Show baseline",
      key: "space",
      on: settings.showBaseline,
      toggle: () => settings.setShowBaseline(!settings.showBaseline),
    };
  }
  return null;
}

function ModeSwitch({
  settings,
  snapshot,
}: {
  settings: ViewerSettings;
  snapshot: ViewerSnapshot;
}) {
  const option = modeSwitch(settings, snapshot);
  if (option === null) {
    return null;
  }
  return (
    <>
      <span className="mx-1 h-4 w-px bg-field-border/50 max-sm:hidden" />
      <KeyTooltip label={option.label} keyName={option.key}>
        <button
          type="button"
          role="switch"
          aria-checked={option.on}
          onClick={option.toggle}
          className={`flex h-7 items-center gap-2 rounded-[9px] px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-100 ${
            option.on ? "text-text" : "text-muted hover:text-text"
          }`}
        >
          <span
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors duration-100 ${option.on ? "bg-accent" : "bg-field-border/60"}`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-surface transition-[left] duration-100 ${option.on ? "left-3.5" : "left-0.5"}`}
            />
          </span>
          {option.label}
          {option.key && <KeyChip keyName={option.key} />}
        </button>
      </KeyTooltip>
    </>
  );
}

function DiffColorFilters() {
  return (
    <svg aria-hidden className="absolute size-0">
      {DIFF_COLORS.map((option) => (
        <filter
          key={option.value}
          id={`diff-color-${option.value}`}
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodColor={option.color} />
          <feComposite operator="in" in2="SourceAlpha" />
        </filter>
      ))}
    </svg>
  );
}

const STACK_STEP = 3;

function DiffColorStack({
  value,
  onChange,
}: {
  value: DiffColor;
  onChange: (value: DiffColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = useId();
  const selected = Math.max(
    0,
    DIFF_COLORS.findIndex((option) => option.value === value),
  );
  const behind = DIFF_COLORS.map((_, index) => index).filter(
    (index) => index !== selected,
  );
  const offset = (index: number) => {
    const steps = index === selected ? 0 : behind.indexOf(index) + 1;
    return open
      ? `calc(var(--swatch-step) * ${steps})`
      : `${steps * STACK_STEP}px`;
  };
  const width = open
    ? `calc(var(--swatch-step) * ${DIFF_COLORS.length - 1} + 28px)`
    : `${behind.length * STACK_STEP + 28}px`;

  return (
    <Tooltip
      label="Diff color, press c"
      align="end"
      className="pointer-coarse:hidden"
    >
      <fieldset
        aria-label="Diff color"
        className="relative m-0 h-7 rounded-[9px] border-0 p-0 transition-[width] duration-150 ease-out-strong [--swatch-step:20px] motion-reduce:transition-none pointer-coarse:[--swatch-step:36px]"
        style={{ width }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            setOpen(true);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setOpen(false);
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            setOpen(true);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
          }
        }}
      >
        {DIFF_COLORS.map((option, index) => {
          const active = index === selected;
          return (
            <label
              key={option.value}
              title={open ? option.label : undefined}
              className="absolute top-1/2 right-2 size-3 cursor-pointer rounded-full transition-transform duration-150 ease-out-strong after:absolute after:-inset-1 motion-reduce:transition-none pointer-coarse:after:-inset-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus"
              style={{
                transform: `translate(calc(-1 * ${offset(index)}), -50%)`,
                zIndex: active
                  ? DIFF_COLORS.length
                  : DIFF_COLORS.length - 1 - behind.indexOf(index),
                backgroundColor: option.color,
                boxShadow: active
                  ? "0 0 0 2px var(--color-surface-2), 0 0 0 3.5px var(--color-text)"
                  : "0 0 0 1.5px var(--color-surface-2)",
              }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                aria-label={option.label}
                className="sr-only"
                onChange={() => onChange(option.value)}
              />
            </label>
          );
        })}
      </fieldset>
    </Tooltip>
  );
}

function KeyChip({ keyName }: { keyName: string }) {
  return (
    <span className="max-lg:hidden">
      <Kbd>{keyName}</Kbd>
    </span>
  );
}

function KeyTooltip({
  label,
  keyName,
  children,
}: {
  label: string;
  keyName?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  return keyName === undefined ? (
    children
  ) : (
    <Tooltip label={`${label}, press ${keyName}`} className="lg:hidden">
      {children}
    </Tooltip>
  );
}

function Compare({
  settings,
  snapshot,
  image,
  baselineImage,
  baselineLabel,
  newLabel,
  view,
  paneRef,
}: {
  settings: ViewerSettings;
  snapshot: ViewerSnapshot;
  image: Image;
  baselineImage: Image;
  baselineLabel: string;
  newLabel: string;
  view: CanvasView;
  paneRef: Ref<HTMLDivElement>;
}) {
  const { mode, showBaseline, diffOnly, sideDiff, diffColor } = settings;
  const { scale } = view;

  if (mode === "side") {
    return (
      <>
        <Pane caption={baselineLabel} view={view} paneRef={paneRef}>
          <Frame image={baselineImage} scale={scale} caption={baselineLabel} />
        </Pane>
        <Pane caption={newLabel} view={view}>
          <Frame
            image={image}
            scale={scale}
            caption={newLabel}
            overlay={sideDiff ? snapshot.diffImage : null}
            overlayColor={diffColor}
          />
        </Pane>
      </>
    );
  }
  if (mode === "diff") {
    return (
      <Pane
        caption={diffOnly ? "Diff" : `${newLabel} with diff`}
        view={view}
        paneRef={paneRef}
      >
        <Frame
          image={diffOnly ? null : image}
          scale={scale}
          caption={diffOnly ? "Diff" : `${newLabel} with diff`}
          overlay={snapshot.diffImage}
          overlayColor={diffColor}
          size={image}
        />
      </Pane>
    );
  }
  if (mode === "slider") {
    return (
      <Pane
        caption={
          <>
            <span>{baselineLabel}</span>
            <span>{newLabel}</span>
          </>
        }
        view={view}
        paneRef={paneRef}
      >
        <Slider image={image} baselineImage={baselineImage} scale={scale} />
      </Pane>
    );
  }
  return (
    <Pane
      caption={showBaseline ? baselineLabel : newLabel}
      view={view}
      paneRef={paneRef}
    >
      <Frame
        image={showBaseline ? baselineImage : image}
        scale={scale}
        caption={showBaseline ? baselineLabel : newLabel}
        highlighted={showBaseline}
      />
    </Pane>
  );
}

function contentSize(
  snapshot: ViewerSnapshot,
  mode: ViewerMode,
  single: boolean,
): Size {
  const { image, baselineImage } = snapshot;
  const shown =
    single || mode === "diff"
      ? [image ?? baselineImage]
      : [image, baselineImage];
  const images = shown.filter((value) => value !== null);
  return {
    width: Math.max(1, ...images.map((value) => value.width)),
    height: Math.max(1, ...images.map((value) => value.height)),
  };
}

const WHEEL_ZOOM_LIMIT = 25;

type Pointers = Map<number, Point>;

function useCanvas(settings: ViewerSettings, content: Size) {
  const { view: stored, setView, zoomTo } = settings;
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [panning, setPanning] = useState(false);
  const latest = useRef({ viewport, content, view: null as CanvasView | null });

  const resolve = (value: CanvasView | null, size: Size, box: Size) =>
    value === null ? fitView(size, box) : clampView(value, size, box);
  const view =
    viewport === null
      ? { scale: 1, x: 0, y: 0 }
      : resolve(stored, viewport, content);
  latest.current = { viewport, content, view };
  const pannable =
    viewport !== null &&
    (content.width * view.scale + 2 * CANVAS_PADDING > viewport.width ||
      content.height * view.scale + 2 * CANVAS_PADDING > viewport.height);

  const update = (change: (current: CanvasView, size: Size) => CanvasView) =>
    setView((value) => {
      const { viewport: size, content: box } = latest.current;
      return size === null ? value : change(resolve(value, size, box), size);
    });
  const zoomAt = (scale: (current: number) => number, anchor?: Point) =>
    update((current, size) =>
      zoomView(
        current,
        scale(current.scale),
        anchor ?? { x: size.width / 2, y: size.height / 2 },
        size,
        latest.current.content,
      ),
    );
  const pan = (delta: Point) =>
    update((current, size) =>
      panView(current, delta, size, latest.current.content),
    );
  const actions = useRef({ zoomAt, pan });
  actions.current = { zoomAt, pan };

  useEffect(() => {
    zoomTo.current = (zoom) =>
      actions.current.zoomAt((scale) =>
        "to" in zoom ? zoom.to : scale * zoom.by,
      );
  }, [zoomTo]);

  const paneRef = useCallback((element: HTMLDivElement | null) => {
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }
      const { width, height } = entry.contentRect;
      setViewport((value) =>
        value?.width === width && value.height === height
          ? value
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (stage === null) {
      return;
    }
    const anchorOf = (target: EventTarget | null, point: Point): Point => {
      const pane =
        (target as HTMLElement | null)?.closest("[data-pane]") ??
        stage.querySelector("[data-pane]");
      const rect = pane?.getBoundingClientRect();
      return rect === undefined
        ? point
        : { x: point.x - rect.left, y: point.y - rect.top };
    };

    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : 1;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = Math.max(
          -WHEEL_ZOOM_LIMIT,
          Math.min(WHEEL_ZOOM_LIMIT, event.deltaY * unit),
        );
        actions.current.zoomAt(
          (scale) => scale * Math.exp(-delta / 100),
          anchorOf(event.target, { x: event.clientX, y: event.clientY }),
        );
        return;
      }
      const horizontal = event.shiftKey && event.deltaX === 0;
      const delta = {
        x: -(horizontal ? event.deltaY : event.deltaX) * unit,
        y: horizontal ? 0 : -event.deltaY * unit,
      };
      const { viewport: size, content: box, view: current } = latest.current;
      if (size === null || current === null) {
        return;
      }
      const next = panView(current, delta, size, box);
      if (next.x === current.x && next.y === current.y) {
        return;
      }
      event.preventDefault();
      actions.current.pan(delta);
    };

    let gestureScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      const factor = gesture.scale / gestureScale;
      gestureScale = gesture.scale;
      actions.current.zoomAt(
        (scale) => scale * factor,
        anchorOf(event.target, { x: gesture.clientX, y: gesture.clientY }),
      );
    };

    const pointers: Pointers = new Map();
    const center = () => {
      const points = [...pointers.values()];
      return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      };
    };
    const spread = () => {
      const [first, second] = [...pointers.values()];
      return first === undefined || second === undefined
        ? 0
        : Math.hypot(first.x - second.x, first.y - second.y);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        (event.pointerType === "mouse" && event.button !== 0) ||
        (event.target as HTMLElement).closest("button, input")
      ) {
        return;
      }
      stage.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      setPanning(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) {
        return;
      }
      const before = center();
      const beforeSpread = spread();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = center();
      const afterSpread = spread();
      actions.current.pan({ x: after.x - before.x, y: after.y - before.y });
      if (beforeSpread > 0 && afterSpread > 0) {
        actions.current.zoomAt(
          (scale) => (scale * afterSpread) / beforeSpread,
          anchorOf(event.target, after),
        );
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        setPanning(false);
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("gesturestart", onGestureStart);
    stage.addEventListener("gesturechange", onGestureChange);
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("gesturestart", onGestureStart);
      stage.removeEventListener("gesturechange", onGestureChange);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
    };
  }, [stage]);

  return { view, panning, pannable, stageRef: setStage, paneRef };
}

function Pane({
  caption,
  view,
  paneRef,
  children,
}: {
  caption: ReactNode;
  view: CanvasView;
  paneRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <figure className="flex min-h-0 min-w-0 flex-col bg-canvas">
      <figcaption className="flex h-7 shrink-0 items-end justify-between gap-4 px-4 text-xs text-muted">
        {caption}
      </figcaption>
      <div
        ref={paneRef}
        data-pane
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}

const FRAME_PLACEHOLDER = "skeleton bg-surface";

function imageStyle(image: Image, scale: number) {
  return {
    width: Math.round(image.width * scale),
    maxWidth: "none",
    imageRendering: scale > 1 ? ("pixelated" as const) : undefined,
  };
}

function Frame({
  image,
  scale,
  caption,
  overlay,
  overlayColor = "magenta",
  size,
  highlighted = false,
}: {
  image: Image | null;
  scale: number;
  caption: string;
  overlay?: Image | null;
  overlayColor?: DiffColor;
  size?: Image;
  highlighted?: boolean;
}) {
  const base = image ?? overlay;
  if (base == null) {
    return <p className="text-sm text-muted">Image not available.</p>;
  }
  return (
    <div
      className={`checker relative block outline-offset-0 ${
        highlighted ? "outline-2 outline-link" : "outline-1 outline-border"
      } outline-solid`}
    >
      {image === null && size !== undefined ? (
        <div
          className="block"
          style={{
            ...imageStyle(size, scale),
            aspectRatio: `${size.width} / ${size.height}`,
          }}
        />
      ) : (
        image !== null && (
          <SnapshotImage
            image={image}
            alt={caption}
            placeholder={FRAME_PLACEHOLDER}
            retryable
            className="block"
            style={imageStyle(image, scale)}
            draggable={false}
          />
        )
      )}
      {overlay && (
        <SnapshotImage
          image={overlay}
          alt="Diff overlay"
          placeholder={false}
          className="pointer-events-none absolute top-0 left-0 block opacity-70"
          style={{
            ...imageStyle(overlay, scale),
            filter: `url(#diff-color-${overlayColor})`,
          }}
          draggable={false}
        />
      )}
    </div>
  );
}

function Slider({
  image,
  baselineImage,
  scale,
}: {
  image: Image;
  baselineImage: Image;
  scale: number;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div className="checker relative block outline-1 outline-border outline-solid">
      <SnapshotImage
        image={image}
        alt="New"
        placeholder={FRAME_PLACEHOLDER}
        className="block"
        style={imageStyle(image, scale)}
        draggable={false}
      />
      <SnapshotImage
        image={baselineImage}
        alt="Baseline"
        placeholder={FRAME_PLACEHOLDER}
        className="absolute top-0 left-0 block"
        style={{
          ...imageStyle(baselineImage, scale),
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
        draggable={false}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-link"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex h-6 w-6 -translate-1/2 items-center justify-center rounded-full bg-surface text-muted shadow-menu ring-1 ring-border">
          <CaretLeftIcon size={8} weight="bold" />
          <CaretRightIcon size={8} weight="bold" />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        aria-label="Baseline and new divider"
        className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        onChange={(event) => setPosition(Number(event.target.value))}
        onKeyDown={(event) => {
          if (
            event.shiftKey &&
            (event.key === "ArrowLeft" || event.key === "ArrowRight")
          ) {
            event.preventDefault();
            const step = event.key === "ArrowLeft" ? -10 : 10;
            setPosition((value) => Math.min(100, Math.max(0, value + step)));
          }
        }}
      />
    </div>
  );
}

function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: {
    value: Value;
    label: string;
    shortLabel?: string;
    icon?: Icon;
    key?: string;
  }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset aria-label={label} className="flex min-w-0 flex-wrap">
      {options.map((option) => {
        const active = option.value === value;
        const OptionIcon = option.icon;
        return (
          <KeyTooltip
            key={option.value}
            label={option.label}
            keyName={option.key}
          >
            <button
              type="button"
              aria-pressed={active}
              className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-100 ${
                active
                  ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                  : "text-muted hover:text-text"
              }`}
              onClick={() => onChange(option.value)}
            >
              {OptionIcon && <OptionIcon size={16} />}
              {option.shortLabel !== undefined ? (
                <>
                  <span className="max-sm:hidden">{option.label}</span>
                  <span className="sm:hidden">{option.shortLabel}</span>
                </>
              ) : (
                option.label
              )}
              {option.key !== undefined && <KeyChip keyName={option.key} />}
            </button>
          </KeyTooltip>
        );
      })}
    </fieldset>
  );
}
