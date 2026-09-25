import { useCallback, useEffect, useState } from "react";
import { formatCount, formatPercent } from "../lib/format";
import { type DiffStatus, DiffStatusPill, Kbd } from "./ui";

export type ViewerMode = "side" | "diff" | "slider" | "flip";
export type ViewerZoom = "fit" | "100" | "200";

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

export const MODES: { value: ViewerMode; label: string; key: string }[] = [
  { value: "side", label: "Side by side", key: "1" },
  { value: "diff", label: "Diff", key: "2" },
  { value: "slider", label: "Slider", key: "3" },
  { value: "flip", label: "Flip", key: "4" },
];

const ZOOMS: { value: ViewerZoom; label: string }[] = [
  { value: "fit", label: "Fit" },
  { value: "100", label: "100%" },
  { value: "200", label: "200%" },
];

function useStoredState<Value extends string>(
  key: string,
  initial: Value,
  allowed: Value[],
) {
  const [value, setValue] = useState<Value>(initial);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key) as Value | null;
      if (stored !== null && allowed.includes(stored)) {
        setValue(stored);
      }
    } catch {}
  }, [key, allowed]);
  const update = useCallback(
    (next: Value) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {}
    },
    [key],
  );
  return [value, update] as const;
}

const MODE_VALUES = MODES.map((mode) => mode.value);
const ZOOM_VALUES = ZOOMS.map((zoom) => zoom.value);

export function useViewerSettings() {
  const [mode, setMode] = useStoredState<ViewerMode>(
    "viewer-mode",
    "side",
    MODE_VALUES,
  );
  const [zoom, setZoom] = useStoredState<ViewerZoom>(
    "viewer-zoom",
    "fit",
    ZOOM_VALUES,
  );
  const [showBaseline, setShowBaseline] = useState(false);
  return { mode, setMode, zoom, setZoom, showBaseline, setShowBaseline };
}

export type ViewerSettings = ReturnType<typeof useViewerSettings>;

export function Viewer({
  snapshot,
  baselineLabel,
  newLabel,
  settings,
}: {
  snapshot: ViewerSnapshot;
  baselineLabel: string;
  newLabel: string;
  settings: ViewerSettings;
}) {
  const { mode, setMode, zoom, setZoom } = settings;
  const { image, baselineImage } = snapshot;
  const single = image === null || baselineImage === null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <h2
          className="truncate font-mono text-base font-medium"
          title={snapshot.name}
        >
          {snapshot.name}
        </h2>
        <DiffStatusPill status={snapshot.diffStatus} />
        {snapshot.diffRatio !== null && (
          <span className="text-xs text-muted tabular-nums">
            {formatPercent(snapshot.diffRatio)} diff
            {snapshot.diffPixels !== null &&
              `, ${formatCount(snapshot.diffPixels)} px`}
          </span>
        )}
        <Dimensions baseline={baselineImage} image={image} />
      </div>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-4">
        {!single && (
          <Segmented
            label="View mode"
            options={MODES.map(({ value, label, key }) => ({
              value,
              label,
              hint: key,
            }))}
            value={mode}
            onChange={setMode}
          />
        )}
        <div className="ml-auto">
          <Segmented
            label="Zoom"
            options={ZOOMS}
            value={zoom}
            onChange={setZoom}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-4">
        {single ? (
          <Frame
            image={image ?? baselineImage}
            zoom={zoom}
            caption={image === null ? baselineLabel : newLabel}
          />
        ) : (
          <Compare
            settings={settings}
            snapshot={snapshot}
            image={image}
            baselineImage={baselineImage}
            baselineLabel={baselineLabel}
            newLabel={newLabel}
          />
        )}
      </div>
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
    <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">
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

function Compare({
  settings,
  snapshot,
  image,
  baselineImage,
  baselineLabel,
  newLabel,
}: {
  settings: ViewerSettings;
  snapshot: ViewerSnapshot;
  image: Image;
  baselineImage: Image;
  baselineLabel: string;
  newLabel: string;
}) {
  const { mode, zoom, showBaseline, setShowBaseline } = settings;

  if (mode === "side") {
    return (
      <div className="grid grid-cols-2 items-start gap-4 max-md:grid-cols-1">
        <Frame image={baselineImage} zoom={zoom} caption={baselineLabel} />
        <Frame image={image} zoom={zoom} caption={newLabel} />
      </div>
    );
  }
  if (mode === "diff") {
    return (
      <Frame
        image={image}
        zoom={zoom}
        caption={newLabel}
        overlay={snapshot.diffImage}
      />
    );
  }
  if (mode === "slider") {
    return <Slider image={image} baselineImage={baselineImage} zoom={zoom} />;
  }
  return (
    <div>
      <button
        type="button"
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-link"
        onClick={() => setShowBaseline(!showBaseline)}
      >
        Show {showBaseline ? "new" : "baseline"} <Kbd>space</Kbd>
      </button>
      <Frame
        image={showBaseline ? baselineImage : image}
        zoom={zoom}
        caption={showBaseline ? baselineLabel : newLabel}
        highlighted={showBaseline}
      />
    </div>
  );
}

function imageStyle(image: Image, zoom: ViewerZoom) {
  if (zoom === "fit") {
    return { maxWidth: "100%" };
  }
  const scale = zoom === "200" ? 2 : 1;
  return {
    width: image.width * scale,
    maxWidth: "none",
    imageRendering: scale > 1 ? ("pixelated" as const) : undefined,
  };
}

function Frame({
  image,
  zoom,
  caption,
  overlay,
  highlighted = false,
}: {
  image: Image | null;
  zoom: ViewerZoom;
  caption: string;
  overlay?: Image | null;
  highlighted?: boolean;
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="h-6 text-xs text-muted">{caption}</figcaption>
      {image === null ? (
        <p className="text-sm text-muted">Image not available.</p>
      ) : (
        <div
          className={`checker relative inline-block border align-top ${highlighted ? "border-link" : "border-transparent"}`}
        >
          <img
            src={image.url}
            alt={caption}
            className="block"
            style={imageStyle(image, zoom)}
          />
          {overlay && (
            <img
              src={overlay.url}
              alt="Diff overlay"
              className="absolute top-0 left-0 block opacity-70"
              style={imageStyle(overlay, zoom)}
            />
          )}
        </div>
      )}
    </figure>
  );
}

function Slider({
  image,
  baselineImage,
  zoom,
}: {
  image: Image;
  baselineImage: Image;
  zoom: ViewerZoom;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div className="checker relative inline-block align-top select-none">
      <img
        src={image.url}
        alt="New"
        className="block"
        style={imageStyle(image, zoom)}
        draggable={false}
      />
      <img
        src={baselineImage.url}
        alt="Baseline"
        className="absolute top-0 left-0 block"
        style={{
          ...imageStyle(baselineImage, zoom),
          clipPath: `inset(0 ${100 - position}% 0 0)`,
        }}
        draggable={false}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-link"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 size-6 -translate-1/2 rounded-full border border-border bg-surface" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        aria-label="Baseline and new divider"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        onChange={(event) => setPosition(Number(event.target.value))}
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
  options: { value: Value; label: string; hint?: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex rounded-control border-0 bg-surface-2 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          title={
            option.hint ? `${option.label} (${option.hint})` : option.label
          }
          className={`h-7 rounded-sm border px-2.5 text-sm font-medium ${
            option.value === value
              ? "border-border bg-surface text-text"
              : "border-transparent text-muted hover:text-text"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
