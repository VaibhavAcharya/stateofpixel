import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChatTextIcon,
  CheckIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import type { Id } from "@stateofpixel/backend/dataModel";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "uiofcraft";
import { formatCount } from "../../lib/format";
import {
  REVIEW_ICONS,
  RelativeTime,
  type ReviewState,
  Skeleton,
  TONE_TEXT,
  Tooltip,
} from "../ui";
import { Viewer, type ViewerSettings } from "../Viewer";
import { BuildNotFound } from "./BuildNotFound";
import { useBuildData } from "./buildData";
import { CommentDialog } from "./CommentDialog";
import { storyName, storyReviewState } from "./stories";
import type { Build, Snapshot, SnapshotRow } from "./types";

export function SnapshotDetail({
  owner,
  repo,
  build,
  snapshotId,
  settings,
  headings = true,
  canReview,
  onApprove,
  onReject,
  commenting,
  onOpenComments,
  onCloseComments,
  onComment,
  onUndo,
  onMarkUnstable,
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
  canReview: boolean;
  onApprove: () => void;
  onReject: () => void;
  commenting: boolean;
  onOpenComments: () => void;
  onCloseComments: () => void;
  onComment: (body: string) => void;
  onUndo: () => void;
  onMarkUnstable: () => void;
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
          <Skeleton className="aspect-[16/10] max-h-full w-full bg-card" />
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
              <span className="text-xs text-muted-foreground tabular-nums">
                {pending > 0
                  ? `${formatCount(pending)}/${formatCount(story.length)} to review`
                  : `${formatCount(story.length)} snapshots`}
                {rejected > 0 && `, ${formatCount(rejected)} rejected`}
              </span>
            )}
            {navigation}
          </>
        }
        overlay={
          <ReviewDock
            state={
              !reviewable
                ? null
                : story === undefined
                  ? snapshot.reviewState
                  : storyReviewState(story)
            }
            canUndo={
              reviewable &&
              (story ?? [snapshot]).some(
                (row) =>
                  row.reviewState === "approved" ||
                  row.reviewState === "rejected",
              )
            }
            count={story?.length}
            comments={snapshot.comments.length}
            onPrevious={onPrevious}
            onNext={onNext}
            onApprove={onApprove}
            onReject={onReject}
            onComments={onOpenComments}
            onUndo={onUndo}
          />
        }
        headings={headings}
      />
      {snapshot.flaky !== null && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
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
      {snapshot.diffStatus === "changed" &&
        (snapshot.unstable || reviewable) && (
          <p className="flex shrink-0 flex-wrap items-center gap-x-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {snapshot.unstable ? (
              <>
                <span>
                  Marked unstable, changes are approved automatically.
                </span>
                <Link
                  to="/$owner/$repo/settings"
                  params={{ owner, repo }}
                  className="text-link"
                >
                  Settings
                </Link>
              </>
            ) : (
              <Button
                variant="link"
                className="h-auto border-0 p-0 text-xs font-normal text-link sm:h-auto sm:text-xs"
                onClick={onMarkUnstable}
              >
                Mark unstable
              </Button>
            )}
          </p>
        )}
      {snapshot.history.length > 0 && (
        <p className="flex shrink-0 flex-wrap items-center gap-x-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <Link
            to="/$owner/$repo/baselines/$"
            params={{ owner, repo, _splat: snapshot.name }}
            search={{
              suite:
                build.buildName === "default" ? undefined : build.buildName,
            }}
            className="hover:text-foreground"
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
      <CommentDialog
        open={commenting}
        name={story === undefined ? snapshot.name : storyName(snapshot.name)}
        comments={snapshot.comments}
        canReview={reviewable}
        onSubmit={onComment}
        onClose={onCloseComments}
      />
    </>
  );
}

function ReviewDock({
  state,
  canUndo,
  count,
  comments,
  onPrevious,
  onNext,
  onApprove,
  onReject,
  onComments,
  onUndo,
}: {
  state: ReviewState | null;
  canUndo: boolean;
  count: number | undefined;
  comments: number;
  onPrevious: () => void;
  onNext: () => void;
  onApprove: () => void;
  onReject: () => void;
  onComments: () => void;
  onUndo: () => void;
}) {
  const suffix = count === undefined ? "" : ` ${formatCount(count)}`;
  const group =
    "flex items-center gap-0.5 rounded-xl border bg-popover p-1 shadow-lg/5";
  return (
    <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
      <div className={group}>
        <DockButton
          label="Previous snapshot"
          tooltip="Previous"
          keyName="k"
          onClick={onPrevious}
        >
          <CaretLeftIcon size={14} />
        </DockButton>
        <DockButton
          label={`Reject${suffix}`}
          tooltip="Reject"
          keyName="r"
          pressed={state === "rejected"}
          disabled={state === null}
          className="text-rejected!"
          onClick={onReject}
        >
          <XIcon size={16} weight="bold" />
        </DockButton>
        <DockButton
          label={`Approve${suffix}`}
          tooltip="Approve"
          keyName="a"
          pressed={state === "approved"}
          disabled={state === null}
          className="text-approved!"
          onClick={onApprove}
        >
          <CheckIcon size={16} weight="bold" />
        </DockButton>
        <DockButton
          label="Undo"
          tooltip="Undo"
          keyName="u"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <ArrowCounterClockwiseIcon size={16} />
        </DockButton>
        <DockButton
          label="Next snapshot"
          tooltip="Next"
          keyName="j"
          onClick={onNext}
        >
          <CaretRightIcon size={14} />
        </DockButton>
      </div>
      <div className={`${group} absolute top-0 left-full ml-2`}>
        <DockButton
          label={`Comments, ${formatCount(comments)}`}
          tooltip="Comments"
          keyName="m"
          className={comments > 0 ? "w-auto! gap-1! px-2!" : ""}
          onClick={onComments}
        >
          <ChatTextIcon size={16} />
          {comments > 0 && (
            <span className="text-xs tabular-nums">
              {formatCount(comments)}
            </span>
          )}
        </DockButton>
      </div>
    </div>
  );
}

function DockButton({
  label,
  tooltip,
  keyName,
  pressed,
  disabled = false,
  className = "",
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  keyName: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={`${tooltip}, press ${keyName}`} align="center">
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        className={`rounded-sm! aria-pressed:bg-accent ${className}`}
        onClick={onClick}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function ReviewStatus({ snapshot }: { snapshot: Snapshot }) {
  const review = snapshot.lastReview;
  if (snapshot.reviewState === "none") {
    return (
      <span className="text-xs text-muted-foreground">
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
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
        : review.source === "unstable"
          ? "automatically, marked unstable"
          : review.login === null
            ? "automatically"
            : `by @${review.login}`;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Icon
        size={14}
        weight="bold"
        className={`shrink-0 ${TONE_TEXT[snapshot.reviewState]}`}
      />
      <span className="truncate">
        {verb} {who} <RelativeTime timestamp={review.createdAt} />
        {review.comment && (
          <span className="text-foreground">: {review.comment}</span>
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
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<footer />}
      className="shrink-0 border-t border-border text-xs"
    >
      <CollapsibleTrigger className="flex h-8 w-full items-center gap-1.5 px-4 text-muted-foreground hover:text-foreground">
        <Caret size={12} />
        Details
        {!open && (
          <span className="min-w-0 truncate text-muted-foreground">
            {entries
              .map(([key, value]) => `${key} ${String(value)}`)
              .join(", ")}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 px-4 pb-3 pl-[34px]">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="mono truncate">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </CollapsiblePanel>
    </Collapsible>
  );
}
