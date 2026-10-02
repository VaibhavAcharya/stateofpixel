import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import type { Id } from "@stateofpixel/backend/dataModel";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { formatCount } from "../../lib/format";
import {
  buttonClass,
  REVIEW_ICONS,
  RelativeTime,
  type ReviewState,
  Skeleton,
  TONE_TEXT,
} from "../ui";
import { Viewer, type ViewerSettings } from "../Viewer";
import { BuildNotFound } from "./BuildNotFound";
import { useBuildData } from "./buildData";
import { storyReviewState } from "./stories";
import type { Build, Snapshot, SnapshotRow } from "./types";

export function SnapshotDetail({
  owner,
  repo,
  build,
  snapshotId,
  settings,
  headings = true,
  canWrite,
  canReview,
  onApprove,
  onReject,
  onUndo,
  navigation,
  story,
  onPrevious,
  onNext,
}: {
  owner: string;
  repo: string;
  build: Build;
  snapshotId: Id<"snapshots">;
  settings: ViewerSettings;
  headings?: boolean;
  canWrite: boolean;
  canReview: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
  navigation: ReactNode;
  story?: SnapshotRow[];
  onPrevious: () => void;
  onNext: () => void;
}) {
  const snapshot = useBuildData().useSnapshot({
    owner,
    name: repo,
    number: build.number,
    snapshotId,
  });
  if (snapshot === undefined) {
    return (
      <>
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Skeleton className="h-3.5 w-56 rounded-xs" />
        </div>
        <div className="min-h-0 flex-1 bg-canvas p-4">
          <Skeleton className="aspect-[16/10] max-h-full w-full bg-surface" />
        </div>
      </>
    );
  }
  if (snapshot === null) {
    return <BuildNotFound title="Snapshot not found." />;
  }
  const reviewable = canReview && snapshot.reviewState !== "none";
  const pending = (story ?? []).filter(
    (row) => row.reviewState === "pending",
  ).length;
  const rejected = (story ?? []).filter(
    (row) => row.reviewState === "rejected",
  ).length;

  return (
    <>
      <Viewer
        snapshot={snapshot}
        settings={settings}
        baselineLabel={
          build.baseline === null
            ? "Baseline"
            : `Baseline #${build.baseline.number}`
        }
        newLabel={`New #${build.number}`}
        navigation={
          <>
            {story === undefined ? (
              <ReviewStatus snapshot={snapshot} />
            ) : (
              <span className="text-xs text-muted tabular-nums">
                {formatCount(story.length)} snapshots
                {pending > 0 && `, ${formatCount(pending)} waiting for review`}
                {rejected > 0 && `, ${formatCount(rejected)} rejected`}
              </span>
            )}
            {navigation}
          </>
        }
        overlay={
          canWrite && reviewable ? (
            <ReviewDock
              state={
                story === undefined
                  ? snapshot.reviewState
                  : storyReviewState(story)
              }
              count={story?.length}
              onPrevious={onPrevious}
              onNext={onNext}
              onApprove={onApprove}
              onReject={onReject}
              onUndo={onUndo}
            />
          ) : undefined
        }
        headings={headings}
      />
      {snapshot.flaky !== null && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-1.5 border-t border-border px-4 py-2 text-xs text-muted">
          <WarningIcon size={14} className="shrink-0 text-pending" />
          <span>
            Looks flaky:{" "}
            {snapshot.flaky.sameCommitBuild === null
              ? `flipped ${snapshot.flaky.flips} times in ${snapshot.flaky.builds} builds.`
              : `build #${snapshot.flaky.sameCommitBuild} of the same commit has a different image.`}
          </span>
          <Link
            to="/docs/$slug"
            params={{ slug: "stable-screenshots" }}
            className="text-link"
          >
            How to fix it
          </Link>
        </p>
      )}
      {snapshot.history.length > 0 && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-2 border-t border-border px-4 py-2 text-xs text-muted">
          <Link
            to="/$owner/$repo/baselines/$"
            params={{ owner, repo, _splat: snapshot.name }}
            search={{
              suite:
                build.buildName === "default" ? undefined : build.buildName,
            }}
            className="hover:text-text"
          >
            History
          </Link>
          {snapshot.history.map((number) => (
            <Link
              key={number}
              to="/$owner/$repo/builds/$number"
              params={{ owner, repo, number: String(number) }}
              className="text-link tabular-nums"
            >
              #{number}
            </Link>
          ))}
        </p>
      )}
      <Details metadata={snapshot.metadata} />
    </>
  );
}

function ReviewDock({
  state,
  count,
  onPrevious,
  onNext,
  onApprove,
  onReject,
  onUndo,
}: {
  state: ReviewState;
  count: number | undefined;
  onPrevious: () => void;
  onNext: () => void;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const icon = `${buttonClass("ghost", "icon-sm")} aria-pressed:bg-hover`;
  const suffix = count === undefined ? "" : ` ${formatCount(count)}`;
  return (
    <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-[9px] bg-surface p-0.5 shadow-menu ring-1 ring-border">
      <button
        type="button"
        aria-label="Previous snapshot"
        title="Previous, press k"
        className={buttonClass("ghost", "icon-sm")}
        onClick={onPrevious}
      >
        <CaretLeftIcon size={12} />
      </button>
      <button
        type="button"
        aria-label={`Reject${suffix}`}
        aria-pressed={state === "rejected"}
        title="Reject, press r"
        className={`${icon} text-rejected!`}
        onClick={onReject}
      >
        <XIcon size={14} weight="bold" />
      </button>
      <button
        type="button"
        aria-label={`Approve${suffix}`}
        aria-pressed={state === "approved"}
        title="Approve, press a"
        className={`${icon} text-approved!`}
        onClick={onApprove}
      >
        <CheckIcon size={14} weight="bold" />
      </button>
      {(state === "approved" || state === "rejected") && (
        <button
          type="button"
          aria-label="Undo"
          title="Undo, press u"
          className={icon}
          onClick={onUndo}
        >
          <ArrowCounterClockwiseIcon size={14} />
        </button>
      )}
      <button
        type="button"
        aria-label="Next snapshot"
        title="Next, press j"
        className={buttonClass("ghost", "icon-sm")}
        onClick={onNext}
      >
        <CaretRightIcon size={12} />
      </button>
    </div>
  );
}

function ReviewStatus({ snapshot }: { snapshot: Snapshot }) {
  const review = snapshot.lastReview;
  if (snapshot.reviewState === "none") {
    return (
      <span className="text-xs text-muted">
        {snapshot.diffStatus === "removed"
          ? "Not in this build, no review needed"
          : snapshot.diffStatus === "failed"
            ? "Upload or diff failed on CI, push again after fixing the cause"
            : snapshot.image === null
              ? "Not stored, the account was over its storage limit"
              : "Matches the baseline, no review needed"}
      </span>
    );
  }
  if (snapshot.reviewState === "pending" || review === null) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <REVIEW_ICONS.pending size={14} className="text-pending" />
        Waiting for review
        {snapshot.rejectedIn !== null &&
          `, rejected in build #${snapshot.rejectedIn}`}
      </span>
    );
  }
  const Icon = REVIEW_ICONS[snapshot.reviewState];
  const verb =
    review.action === "approve"
      ? "Approved"
      : review.action === "reject"
        ? "Rejected"
        : "Review undone";
  const carriedFrom = review.carriedFrom;
  const who =
    carriedFrom !== null
      ? `in build #${carriedFrom.buildNumber}${carriedFrom.login === null ? "" : ` by @${carriedFrom.login}`} (carried over)`
      : review.source === "orphan"
        ? "as the first baseline"
        : review.login === null
          ? "automatically"
          : `by @${review.login}`;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <Icon
        size={14}
        weight="bold"
        className={`shrink-0 ${TONE_TEXT[snapshot.reviewState]}`}
      />
      <span className="truncate">
        {verb} {who} <RelativeTime timestamp={review.createdAt} />
        {review.comment && (
          <span className="text-text">: {review.comment}</span>
        )}
        {snapshot.notReviewedOnPr && (
          <span className="text-pending">, not reviewed on PR</span>
        )}
      </span>
    </span>
  );
}

function Details({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);
  const [open, setOpen] = useState(false);
  if (entries.length === 0) {
    return null;
  }
  const Caret = open ? CaretDownIcon : CaretRightIcon;
  return (
    <footer className="shrink-0 border-t border-border text-xs">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-1.5 px-4 text-muted hover:text-text"
        onClick={() => setOpen((value) => !value)}
      >
        <Caret size={12} />
        Details
        {!open && (
          <span className="min-w-0 truncate text-subtle">
            {entries
              .map(([key, value]) => `${key} ${String(value)}`)
              .join(", ")}
          </span>
        )}
      </button>
      {open && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 px-4 pb-3 pl-[34px]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted">{key}</dt>
              <dd className="mono truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </footer>
  );
}
