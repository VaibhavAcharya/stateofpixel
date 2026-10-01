import {
  CheckIcon,
  CircleHalfIcon,
  CircleIcon,
  CircleNotchIcon,
  ClockIcon,
  EqualsIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  MinusIcon,
  PlusIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import type { Doc } from "@stateofpixel/backend/dataModel";
import {
  type ComponentProps,
  type ComponentType,
  cloneElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { formatAbsolute, formatCount, formatRelative } from "../lib/format";
import { renewImageGrant, useImageUrl } from "../lib/useImageUrl";

export type DiffStatus = Doc<"snapshots">["diffStatus"];
export type ReviewState = Doc<"snapshots">["reviewState"];
export type BuildStatus = Doc<"builds">["status"];
export type BuildConclusion = NonNullable<Doc<"builds">["conclusion"]>;

type Tone = DiffStatus | Exclude<ReviewState, "none">;

const TONE_CLASSES: Record<Tone, string> = {
  unchanged: "bg-unchanged-bg text-unchanged",
  changed: "bg-changed-bg text-changed",
  added: "bg-added-bg text-added",
  removed: "bg-removed-bg text-removed",
  failed: "bg-failed-bg text-failed",
  pending: "bg-pending-bg text-pending",
  approved: "bg-approved-bg text-approved",
  rejected: "bg-rejected-bg text-rejected",
};

export const TONE_TEXT: Record<Tone, string> = {
  unchanged: "text-unchanged",
  changed: "text-changed",
  added: "text-added",
  removed: "text-removed",
  failed: "text-failed",
  pending: "text-pending",
  approved: "text-approved",
  rejected: "text-rejected",
};

export type Icon = ComponentType<{
  size?: number;
  weight?: "regular" | "bold" | "fill";
  className?: string;
}>;

export const DIFF_ICONS: Record<DiffStatus, Icon> = {
  unchanged: EqualsIcon,
  changed: CircleHalfIcon,
  added: PlusIcon,
  removed: MinusIcon,
  failed: WarningIcon,
};

export const REVIEW_ICONS: Record<Exclude<ReviewState, "none">, Icon> = {
  pending: CircleIcon,
  approved: CheckIcon,
  rejected: XIcon,
};

export function Pill({
  tone,
  icon: IconComponent,
  children,
}: {
  tone: Tone;
  icon: Icon;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-xs pr-1.5 pl-1 text-2xs font-medium whitespace-nowrap tabular-nums ${TONE_CLASSES[tone]}`}
    >
      <IconComponent size={12} weight="bold" />
      {children}
    </span>
  );
}

const DIFF_LABELS: Record<DiffStatus, string> = {
  unchanged: "Unchanged",
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  failed: "Failed",
};

export function DiffStatusPill({ status }: { status: DiffStatus }) {
  return (
    <Pill tone={status} icon={DIFF_ICONS[status]}>
      {DIFF_LABELS[status]}
    </Pill>
  );
}

export function BuildStatePill({
  status,
  conclusion,
  counts,
  shards,
  storageBlocked,
}: {
  status: BuildStatus;
  conclusion: BuildConclusion | null;
  counts: { pending: number; changed: number; added: number; rejected: number };
  shards: { done: number; total: number | null };
  storageBlocked: boolean;
}) {
  if (status === "pending") {
    return (
      <Pill tone="unchanged" icon={Spinner}>
        {shards.total === null || shards.total === 1
          ? "Waiting"
          : `${shards.done} of ${shards.total} shards`}
      </Pill>
    );
  }
  if (status === "expired") {
    return (
      <Pill tone="unchanged" icon={ClockIcon}>
        Expired
      </Pill>
    );
  }
  if (status === "error") {
    return (
      <Pill tone="failed" icon={WarningIcon}>
        Error
      </Pill>
    );
  }
  if (storageBlocked && conclusion !== "no_changes") {
    return (
      <Pill tone="failed" icon={WarningIcon}>
        Not compared
      </Pill>
    );
  }
  switch (conclusion) {
    case "no_changes":
      return (
        <Pill tone="unchanged" icon={EqualsIcon}>
          No changes
        </Pill>
      );
    case "approved":
      return (
        <Pill tone="approved" icon={CheckIcon}>
          Approved
        </Pill>
      );
    case "rejected":
      return (
        <Pill tone="rejected" icon={XIcon}>
          {formatCount(counts.rejected)} rejected
        </Pill>
      );
    default:
      return (
        <Pill tone="pending" icon={CircleIcon}>
          {formatCount(counts.pending)} to review
        </Pill>
      );
  }
}

export function SupersededPill() {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-xs px-1.5 text-2xs font-medium text-muted shadow-[inset_0_0_0_1px_var(--color-border)]">
      Superseded
    </span>
  );
}

export function PrStatePill({
  state,
}: {
  state: "open" | "closed" | "merged" | null;
}) {
  if (state !== "closed" && state !== "merged") {
    return null;
  }
  const Icon = state === "merged" ? GitMergeIcon : GitPullRequestIcon;
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-xs px-1.5 text-2xs font-medium text-muted shadow-[inset_0_0_0_1px_var(--color-border)]">
      <Icon size={12} />
      {state === "merged" ? "PR merged" : "PR closed"}
    </span>
  );
}

export function Spinner({
  size = 12,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <CircleNotchIcon
      size={size}
      weight="bold"
      className={`animate-spin ${className}`}
    />
  );
}

export function Kbd({
  children,
  inverted = false,
}: {
  children: ReactNode;
  inverted?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-xs px-[5px] font-mono text-2xs font-normal ${
        inverted
          ? "bg-accent-fg/15 text-accent-fg/80"
          : "bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-border)]"
      }`}
    >
      {children}
    </kbd>
  );
}

export function RelativeTime({ timestamp }: { timestamp: number }) {
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={formatAbsolute(timestamp)}
      className="whitespace-nowrap tabular-nums"
    >
      {formatRelative(timestamp)}
    </time>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-fg not-aria-disabled:hover:bg-accent-hover",
  secondary:
    "bg-surface text-text shadow-[inset_0_0_0_1px_var(--color-border)] not-aria-disabled:hover:bg-hover",
  ghost:
    "text-muted not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-text",
  danger:
    "bg-surface text-rejected shadow-[inset_0_0_0_1px_var(--color-border)] not-aria-disabled:hover:bg-rejected-bg",
};

const BUTTON_SIZES = {
  md: "h-8 gap-1.5 px-3 text-sm",
  sm: "h-6 gap-1 rounded-sm px-2 text-xs",
  icon: "size-8",
  "icon-sm": "size-6 rounded-sm",
};

export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = "secondary",
  size: keyof typeof BUTTON_SIZES = "md",
) {
  return `inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap transition-colors duration-100 select-none disabled:pointer-events-none disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 pointer-coarse:min-h-11 ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]}`;
}

export function Tooltip({
  label,
  align = "start",
  className = "",
  children,
}: {
  label: string;
  align?: "start" | "end";
  className?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <span className="group/tooltip relative inline-flex">
      {cloneElement(children, { "aria-describedby": id })}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none invisible absolute top-full z-40 mt-1.5 w-max max-w-64 rounded-md bg-surface px-2.5 py-1.5 text-xs font-normal text-text opacity-0 shadow-tooltip ring-1 ring-border transition-opacity duration-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100 ${
          align === "end" ? "right-0" : "left-0"
        } ${className}`}
      >
        {label}
      </span>
    </span>
  );
}

export function LeadCopy({
  title,
  children,
  className = "max-w-[65ch]",
  as: Heading = "h2",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={`text-2xl font-[450] tracking-[-0.035em] text-balance text-muted max-sm:text-xl ${className}`}
    >
      <Heading className="inline font-semibold text-text">{title}</Heading>{" "}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-6 py-12">
      <LeadCopy title={title}>{children}</LeadCopy>
      {action}
    </div>
  );
}

export function ProjectNotFound() {
  return (
    <EmptyState title="Project not found.">
      The repository may not exist here, or you do not have access to it on
      GitHub.
    </EmptyState>
  );
}

export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`skeleton rounded-md ${className}`} />;
}

export function SkeletonRows({
  rows = 6,
  height = "h-10",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: rows }, (_, index) => `skeleton-${index}`).map(
        (key) => (
          <div
            key={key}
            className={`${height} flex items-center gap-6 border-b border-border px-3`}
          >
            <div className="skeleton h-3 w-12 rounded-xs" />
            <div className="skeleton h-3 w-40 rounded-xs" />
            <div className="skeleton ml-auto h-3 w-16 rounded-xs" />
          </div>
        ),
      )}
    </div>
  );
}

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden
      className="shrink-0"
    >
      <rect width="20" height="20" rx="5" fill="currentColor" />
      <rect x="5" y="5" width="4" height="4" className="fill-bg" />
      <rect x="11" y="11" width="4" height="4" className="fill-bg" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em]">
      <Logo />
      stateofpixel
    </span>
  );
}

export function accountAvatar(login: string) {
  return `https://github.com/${login}.png?size=64`;
}

export function Avatar({
  src,
  size = 20,
  square = false,
}: {
  src: string | null | undefined;
  size?: number;
  square?: boolean;
}) {
  const shape = square ? "rounded-xs" : "rounded-full";
  if (!src) {
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 bg-surface-2 ${shape}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 bg-surface-2 ${shape} shadow-[0_0_0_1px_var(--color-border)]`}
    />
  );
}

const VIEWPORT_SUFFIX = /^(.*?)\s*\[([^\]]+)\]$/;

function splitSnapshotName(name: string) {
  const match = VIEWPORT_SUFFIX.exec(name);
  const base = match?.[1] ?? name;
  const slash = base.lastIndexOf("/");
  return {
    parent: slash === -1 ? "" : base.slice(0, slash + 1),
    leaf: slash === -1 ? base : base.slice(slash + 1),
    variant: match?.[2] ?? null,
  };
}

export function SnapshotName({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const { parent, leaf, variant } = splitSnapshotName(name);
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="min-w-0 truncate">
        <span className="text-muted">{parent}</span>
        {leaf}
      </span>
      {variant !== null && (
        <span className="mono shrink-0 text-muted tabular-nums">{variant}</span>
      )}
    </span>
  );
}

export const listRowClass =
  "relative border-b border-border transition-colors duration-100 hover:bg-hover has-[[data-list-row]:focus-visible]:bg-hover";

export const listRowLinkClass =
  "after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-focus)]";

const BLANK_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type SnapshotImageProps = Omit<ComponentProps<"img">, "src" | "alt"> & {
  image: { url: string; width: number; height: number };
  alt: string;
  placeholder?: string | false;
  retryable?: boolean;
};

export function SnapshotImage(props: SnapshotImageProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <LoadingImage
      key={`${props.image.url}#${attempt}`}
      {...props}
      onRetry={() => {
        renewImageGrant(props.image.url);
        setAttempt((value) => value + 1);
      }}
    />
  );
}

function LoadingImage({
  image,
  alt,
  placeholder = "skeleton",
  retryable = false,
  onRetry,
  className = "",
  style,
  ...props
}: SnapshotImageProps & { onRetry: () => void }) {
  const url = useImageUrl(image.url);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const renewed = useRef(false);
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = element.current;
    if (
      url !== undefined &&
      img?.getAttribute("src") === url &&
      img.complete &&
      img.naturalWidth > 0
    ) {
      setState("loaded");
    }
  }, [url]);
  const frameStyle = {
    aspectRatio: `${image.width} / ${image.height}`,
    ...style,
  };
  if (state === "failed" && placeholder !== false && retryable) {
    return (
      <span
        className={`${className} relative z-10 bg-surface-2`}
        style={frameStyle}
      >
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted">
          <WarningIcon size={20} />
          Could not load this image.
          <button type="button" className={buttonClass()} onClick={onRetry}>
            Try again
          </button>
        </span>
      </span>
    );
  }
  const stateClass = {
    loading: placeholder === false ? "invisible" : placeholder,
    loaded: "",
    failed: placeholder === false ? "invisible" : "bg-surface-2",
  }[state];
  return (
    <img
      {...props}
      ref={element}
      src={url ?? BLANK_IMAGE}
      alt={alt}
      title={state === "failed" ? "Could not load this image" : undefined}
      width={image.width}
      height={image.height}
      className={`${className} ${stateClass}`}
      style={frameStyle}
      onLoad={(event) => {
        if (
          url !== undefined &&
          event.currentTarget.getAttribute("src") === url
        ) {
          setState("loaded");
        }
      }}
      onError={() => {
        if (!renewed.current && renewImageGrant(image.url)) {
          renewed.current = true;
          return;
        }
        setState("failed");
      }}
    />
  );
}
