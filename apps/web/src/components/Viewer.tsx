import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { formatCount, formatPercent } from "../lib/format";
import { type DiffStatus, DiffStatusPill, Kbd, SnapshotName } from "./ui";

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

export const MODES: {
  value: ViewerMode;
  label: string;
  shortLabel: string;
  key: string;
}[] = [
  { value: "side", label: "Side by side", shortLabel: "Side", key: "1" },
  { value: "diff", label: "Diff", shortLabel: "Diff", key: "2" },
  { value: "slider", label: "Slider", shortLabel: "Slider", key: "3" },
  { value: "flip", label: "Flip", shortLabel: "Flip", key: "4" },
];

const ZOOMS: { value: ViewerZoom; label: string; key?: string }[] = [
  { value: "fit", label: "Fit", key: "f" },
  { value: "100", label: "100%", key: "0" },
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
  const [diffOnly, setDiffOnly] = useState(false);
  return {
    mode,
    setMode,
    zoom,
    setZoom,
    showBaseline,
    setShowBaseline,
    diffOnly,
    setDiffOnly,
  };
}

export type ViewerSettings = ReturnType<typeof useViewerSettings>;

export function Viewer({
  snapshot,
  baselineLabel,
  newLabel,
  settings,
  navigation,
}: {
  snapshot: ViewerSnapshot;
  baselineLabel: string;
  newLabel: string;
  settings: ViewerSettings;
  navigation: ReactNode;
}) {
  const { mode, setMode, zoom, setZoom } = settings;
  const { image, baselineImage } = snapshot;
  const single = image === null || baselineImage === null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2">
        <h2
          className="min-w-0 text-base font-medium max-sm:w-full"
          title={snapshot.name}
        >
          <SnapshotName name={snapshot.name} />
        </h2>
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
      <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4">
        {!single && (
          <Segmented
            label="View mode"
            options={MODES.map(({ value, label, shortLabel, key }) => ({
              value,
              label,
              shortLabel,
              hint: key,
            }))}
            value={mode}
            onChange={setMode}
          />
        )}
        {!single && mode === "diff" && snapshot.diffImage !== null && (
          <ToggleButton
            pressed={settings.diffOnly}
            onClick={() => settings.setDiffOnly(!settings.diffOnly)}
          >
            Diff only
          </ToggleButton>
        )}
        {!single && mode === "flip" && (
          <ToggleButton
            pressed={settings.showBaseline}
            onClick={() => settings.setShowBaseline(!settings.showBaseline)}
          >
            {settings.showBaseline ? "Showing baseline" : "Showing new"}
            <Kbd>space</Kbd>
          </ToggleButton>
        )}
        <div className="ml-auto max-sm:hidden">
          <Segmented
            label="Zoom"
            options={ZOOMS.map(({ value, label, key }) => ({
              value,
              label,
              hint: key,
            }))}
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

function ToggleButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium transition-colors duration-100 ${
        pressed
          ? "bg-surface-2 text-text"
          : "text-muted hover:bg-hover hover:text-text"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
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
  const { mode, zoom, showBaseline, diffOnly } = settings;

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
        image={diffOnly ? null : image}
        zoom={zoom}
        caption={diffOnly ? "Diff" : `${newLabel} with diff`}
        overlay={snapshot.diffImage}
        size={image}
      />
    );
  }
  if (mode === "slider") {
    return (
      <figure className="min-w-0">
        <figcaption className="flex h-6 items-start justify-between gap-4 text-xs text-muted">
          <span>{baselineLabel}</span>
          <span>{newLabel}</span>
        </figcaption>
        <Slider image={image} baselineImage={baselineImage} zoom={zoom} />
      </figure>
    );
  }
  return (
    <Frame
      image={showBaseline ? baselineImage : image}
      zoom={zoom}
      caption={showBaseline ? baselineLabel : newLabel}
      highlighted={showBaseline}
    />
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
  size,
  highlighted = false,
}: {
  image: Image | null;
  zoom: ViewerZoom;
  caption: string;
  overlay?: Image | null;
  size?: Image;
  highlighted?: boolean;
}) {
  const base = image ?? overlay;
  return (
    <figure className="min-w-0">
      <figcaption className="h-6 text-xs text-muted">{caption}</figcaption>
      {base == null ? (
        <p className="text-sm text-muted">Image not available.</p>
      ) : (
        <div
          className={`checker relative inline-block max-w-full align-top outline-offset-0 ${
            highlighted ? "outline-2 outline-link" : "outline-1 outline-border"
          } outline-solid`}
        >
          {image === null && size !== undefined ? (
            <div
              className="block max-w-full"
              style={{
                width: size.width,
                ...imageStyle(size, zoom),
                aspectRatio: `${size.width} / ${size.height}`,
              }}
            />
          ) : (
            image !== null && (
              <img
                src={image.url}
                alt={caption}
                className="block"
                style={imageStyle(image, zoom)}
              />
            )
          )}
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
    <div className="checker relative inline-block max-w-full align-top outline-1 outline-border outline-solid select-none">
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
    hint?: string;
  }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex shrink-0 rounded-control bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={
              option.hint ? `${option.label} (${option.hint})` : option.label
            }
            className={`group flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-100 ${
              active
                ? "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)]"
                : "text-muted hover:text-text"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.shortLabel !== undefined ? (
              <>
                <span className="max-sm:hidden">{option.label}</span>
                <span className="sm:hidden">{option.shortLabel}</span>
              </>
            ) : (
              option.label
            )}
            {option.hint !== undefined && (
              <span className="font-mono text-2xs font-normal text-subtle max-lg:hidden">
                {option.hint}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
