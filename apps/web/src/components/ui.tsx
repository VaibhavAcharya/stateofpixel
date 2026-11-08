import {
  ArrowBendDownRightIcon,
  CheckIcon,
  CircleHalfIcon,
  CircleIcon,
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
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Button,
  cn,
  Skeleton,
  TooltipPopup,
  Tooltip as TooltipRoot,
  TooltipTrigger,
  Spinner as UiSpinner,
} from "uiofcraft";
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
    <Badge
      variant="secondary"
      className={cn("gap-1 tabular-nums", TONE_CLASSES[tone])}
    >
      <IconComponent size={12} weight="bold" />
      {children}
    </Badge>
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
  counts: {
    pending: number;
    approved: number;
    changed: number;
    added: number;
    rejected: number;
  };
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
          {formatCount(counts.pending)}/
          {formatCount(counts.pending + counts.approved + counts.rejected)} to
          review
        </Pill>
      );
  }
}

const PR_STATES = {
  open: { label: "open", icon: GitPullRequestIcon, className: "text-approved" },
  merged: { label: "merged", icon: GitMergeIcon, className: "text-removed" },
  closed: {
    label: "closed",
    icon: GitPullRequestIcon,
    className: "text-rejected",
  },
} as const;

export function PrStateIcon({
  state,
}: {
  state: "open" | "closed" | "merged" | null;
}) {
  if (state === null) {
    return null;
  }
  const { label, icon: Icon, className } = PR_STATES[state];
  return (
    <span title={`Pull request ${label}`} className="inline-flex">
      <Icon size={14} weight="bold" aria-hidden className={className} />
      <span className="sr-only">Pull request {label}</span>
    </span>
  );
}

export function SupersededMark() {
  return (
    <span title="Superseded by a newer build" className="inline-flex">
      <ArrowBendDownRightIcon
        size={12}
        weight="bold"
        aria-hidden
        className="text-muted-foreground"
      />
      <span className="sr-only">Superseded</span>
    </span>
  );
}

export function SupersededPill() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Superseded
    </Badge>
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
    <Badge variant="outline" className="text-muted-foreground">
      <Icon size={12} />
      {state === "merged" ? "PR merged" : "PR closed"}
    </Badge>
  );
}

export function Spinner({
  size = 12,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return <UiSpinner size={size} weight="bold" className={className} />;
}

export { Kbd } from "uiofcraft";

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

export function Tooltip({
  label,
  side = "bottom",
  align = "start",
  className,
  children,
}: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
  children: ReactElement;
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={children} />
      <TooltipPopup side={side} align={align} className={className}>
        {label}
      </TooltipPopup>
    </TooltipRoot>
  );
}

const LEAD_SIZES = {
  hero: {
    title: "text-[clamp(2.5rem,5.5vw,4.5rem)] leading-none tracking-[-0.02em]",
    body: "mt-5 text-lg",
  },
  section: {
    title: "text-3xl tracking-[-0.01em] sm:text-[2.5rem] sm:leading-[1.1]",
    body: "mt-4 text-lg",
  },
  app: {
    title: "text-xl tracking-[-0.01em]",
    body: "mt-1.5 text-sm",
  },
};

export function LeadCopy({
  title,
  children,
  className = "max-w-[65ch]",
  as: Heading = "h2",
  size = Heading === "h1" ? "hero" : "section",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  size?: keyof typeof LEAD_SIZES;
}) {
  return (
    <div className={className}>
      <Heading
        className={cn(
          "text-balance font-heading font-semibold",
          LEAD_SIZES[size].title,
        )}
      >
        {title}
      </Heading>
      <div
        className={cn(
          "text-pretty text-muted-foreground",
          LEAD_SIZES[size].body,
        )}
      >
        {children}
      </div>
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
    <div className="flex flex-col items-start gap-5 py-12">
      <LeadCopy title={title} size="app">
        {children}
      </LeadCopy>
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

export { Skeleton };

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
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="ml-auto h-3 w-16" />
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
      <rect x="5" y="5" width="4" height="4" className="fill-background" />
      <rect x="11" y="11" width="4" height="4" className="fill-background" />
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
        className={`inline-block shrink-0 bg-muted ${shape}`}
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
      className={`shrink-0 bg-muted ${shape} shadow-[0_0_0_1px_var(--color-border)]`}
    />
  );
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const MARK_GRID = 5;

function markCells(seed: number) {
  const cells: [number, number][] = [];
  for (let row = 0; row < MARK_GRID; row++) {
    for (let column = 0; column < Math.ceil(MARK_GRID / 2); column++) {
      if ((seed >>> (row * 3 + column)) & 1) {
        cells.push([column, row]);
        const mirrored = MARK_GRID - 1 - column;
        if (mirrored !== column) {
          cells.push([mirrored, row]);
        }
      }
    }
  }
  return cells.length > 0 ? cells : [[2, 2] as [number, number]];
}

export function ProjectMark({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  const seed = hashString(name);
  const hue = seed % 360;
  const cell = 14 / MARK_GRID;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden
      shapeRendering="crispEdges"
      className="shrink-0 [--mark-bg:hsl(var(--mark-hue)_70%_94%)] [--mark-fg:hsl(var(--mark-hue)_55%_46%)] dark:[--mark-bg:hsl(var(--mark-hue)_30%_18%)] dark:[--mark-fg:hsl(var(--mark-hue)_60%_62%)]"
      style={{ "--mark-hue": hue } as CSSProperties}
    >
      <rect width="20" height="20" rx="5" fill="var(--mark-bg)" />
      {markCells(seed >>> 8).map(([column, row]) => (
        <rect
          key={`${column}-${row}`}
          x={3 + column * cell}
          y={3 + row * cell}
          width={cell}
          height={cell}
          fill="var(--mark-fg)"
        />
      ))}
    </svg>
  );
}

export function AvatarStack({
  people,
  total = people.length,
  size = 22,
}: {
  people: { login: string; image: string | null }[];
  total?: number;
  size?: number;
}) {
  if (people.length === 0) {
    return null;
  }
  const more = total - people.length;
  return (
    <span className="flex items-center">
      <span className="flex -space-x-1.5">
        {people.map((person) => (
          <span
            key={person.login}
            title={`@${person.login}`}
            className="rounded-full ring-2 ring-card"
          >
            <Avatar src={person.image} size={size} />
          </span>
        ))}
      </span>
      {more > 0 && (
        <span className="ml-1.5 text-muted-foreground text-xs tabular-nums">
          +{formatCount(more)}
        </span>
      )}
      <span className="sr-only">
        {people.map((person) => `@${person.login}`).join(", ")}
        {more > 0 && ` and ${more} more`}
      </span>
    </span>
  );
}

export function ReviewBar({
  counts,
}: {
  counts: { pending: number; approved: number; rejected: number };
}) {
  const total = counts.pending + counts.approved + counts.rejected;
  if (total === 0) {
    return null;
  }
  return (
    <span
      aria-hidden
      className="flex h-1 w-full max-w-28 overflow-hidden rounded-full bg-muted"
    >
      <span
        className="bg-approved"
        style={{ width: `${(counts.approved / total) * 100}%` }}
      />
      <span
        className="bg-rejected"
        style={{ width: `${(counts.rejected / total) * 100}%` }}
      />
      <span
        className="bg-pending/40"
        style={{ width: `${(counts.pending / total) * 100}%` }}
      />
    </span>
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
        <span className="text-muted-foreground">{parent}</span>
        {leaf}
      </span>
      {variant !== null && (
        <span className="mono shrink-0 text-muted-foreground tabular-nums">
          {variant}
        </span>
      )}
    </span>
  );
}

export const listRowClass =
  "relative border-b border-border transition-colors duration-100 hover:bg-accent has-[[data-list-row]:focus-visible]:bg-accent";

export const listRowLinkClass =
  "after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--color-ring)]";

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
        className={`${className} relative z-10 bg-muted`}
        style={frameStyle}
      >
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <WarningIcon size={20} />
          Could not load this image.
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </span>
      </span>
    );
  }
  const stateClass = {
    loading: placeholder === false ? "invisible" : placeholder,
    loaded: "",
    failed: placeholder === false ? "invisible" : "bg-muted",
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
