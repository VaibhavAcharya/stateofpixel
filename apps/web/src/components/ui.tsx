import {
  Check,
  Circle,
  CircleHalf,
  CircleNotch,
  Clock,
  Equals,
  Minus,
  Plus,
  Warning,
  X,
} from "@phosphor-icons/react/ssr";
import type { ComponentType, ReactNode } from "react";
import { formatAbsolute, formatCount, formatRelative } from "../lib/format";

export type DiffStatus =
  | "unchanged"
  | "changed"
  | "added"
  | "removed"
  | "failed";
export type ReviewState = "none" | "pending" | "approved" | "rejected";
export type BuildStatus = "pending" | "finalized" | "expired" | "error";
export type BuildConclusion =
  | "no_changes"
  | "changes"
  | "approved"
  | "rejected";

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

type Icon = ComponentType<{
  size?: number;
  weight?: "regular" | "bold" | "fill";
  className?: string;
}>;

export const DIFF_ICONS: Record<DiffStatus, Icon> = {
  unchanged: Equals,
  changed: CircleHalf,
  added: Plus,
  removed: Minus,
  failed: Warning,
};

export const REVIEW_ICONS: Record<Exclude<ReviewState, "none">, Icon> = {
  pending: Circle,
  approved: Check,
  rejected: X,
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
      className={`inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-2xs font-medium tabular-nums whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      <IconComponent size={12} weight="bold" />
      {children}
    </span>
  );
}

export function DiffStatusPill({ status }: { status: DiffStatus }) {
  return (
    <Pill tone={status} icon={DIFF_ICONS[status]}>
      {status}
    </Pill>
  );
}

export function BuildStatePill({
  status,
  conclusion,
  counts,
  shards,
}: {
  status: BuildStatus;
  conclusion: BuildConclusion | null;
  counts: { pending: number; changed: number; added: number; rejected: number };
  shards: { done: number; total: number | null };
}) {
  if (status === "pending") {
    return (
      <Pill tone="unchanged" icon={Spinner}>
        {shards.total === null || shards.total === 1
          ? "waiting"
          : `${shards.done} of ${shards.total} shards`}
      </Pill>
    );
  }
  if (status === "expired") {
    return (
      <Pill tone="unchanged" icon={Clock}>
        expired
      </Pill>
    );
  }
  if (status === "error") {
    return (
      <Pill tone="failed" icon={Warning}>
        error
      </Pill>
    );
  }
  switch (conclusion) {
    case "no_changes":
      return (
        <Pill tone="unchanged" icon={Equals}>
          no changes
        </Pill>
      );
    case "approved":
      return (
        <Pill tone="approved" icon={Check}>
          approved
        </Pill>
      );
    case "rejected":
      return (
        <Pill tone="rejected" icon={X}>
          {formatCount(counts.rejected)} rejected
        </Pill>
      );
    default:
      return (
        <Pill tone="pending" icon={Circle}>
          {formatCount(counts.pending)} to review
        </Pill>
      );
  }
}

export function SupersededPill() {
  return (
    <span className="inline-flex h-5 items-center rounded-xs border border-border px-1.5 text-2xs font-medium text-muted">
      superseded
    </span>
  );
}

function Spinner({ size = 12 }: { size?: number }) {
  return <CircleNotch size={size} weight="bold" className="animate-spin" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-surface px-[5px] font-mono text-2xs text-muted">
      {children}
    </kbd>
  );
}

export function RelativeTime({ timestamp }: { timestamp: number }) {
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={formatAbsolute(timestamp)}
    >
      {formatRelative(timestamp)}
    </time>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-border bg-surface hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-text",
  danger: "border border-border bg-surface text-rejected hover:bg-hover",
};

export function buttonClass(
  variant: keyof typeof BUTTON_VARIANTS = "secondary",
  size: "md" | "sm" = "md",
) {
  const sizing = size === "md" ? "h-8 px-3 text-sm" : "h-6 px-2 text-xs";
  return `inline-flex items-center justify-center gap-1.5 rounded-control font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-45 ${sizing} ${BUTTON_VARIANTS[variant]}`;
}

export function LeadCopy({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <p className="max-w-[65ch] text-2xl text-muted">
      <strong className="font-semibold text-text">{title}</strong> {children}
    </p>
  );
}

export function SkeletonRows({
  rows = 5,
  height = "h-10",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: rows }, (_, index) => `skeleton-${index}`).map(
        (key) => (
          <div
            key={key}
            className={`${height} animate-pulse rounded-md bg-surface-2`}
          />
        ),
      )}
    </div>
  );
}
