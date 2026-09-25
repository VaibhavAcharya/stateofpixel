import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CaretRightIcon,
} from "@phosphor-icons/react/ssr";
import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  buttonClass,
  Kbd,
  REVIEW_ICONS,
  RelativeTime,
  Skeleton,
  TONE_TEXT,
} from "../ui";
import { Viewer, type ViewerSettings } from "../Viewer";
import { BuildNotFound } from "./BuildNotFound";
import type { Build, Snapshot } from "./types";

export function SnapshotDetail({
  owner,
  repo,
  build,
  snapshotId,
  settings,
  canWrite,
  canReview,
  rejecting,
  onStartReject,
  onCancelReject,
  onApprove,
  onReject,
  onUndo,
  navigation,
}: {
  owner: string;
  repo: string;
  build: Build;
  snapshotId: Id<"snapshots">;
  settings: ViewerSettings;
  canWrite: boolean;
  canReview: boolean;
  rejecting: boolean;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: (comment: string) => void;
  onUndo: () => void;
  navigation: ReactNode;
}) {
  const snapshot = useQuery(api.snapshots.get, {
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
        <div className="flex-1 bg-canvas p-4">
          <Skeleton className="aspect-[16/10] w-full bg-surface" />
        </div>
      </>
    );
  }
  if (snapshot === null) {
    return <BuildNotFound title="Snapshot not found." />;
  }
  const reviewable = canReview && snapshot.reviewState !== "none";

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
        navigation={navigation}
      />
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-2.5">
        {rejecting ? (
          <RejectForm onSubmit={onReject} onCancel={onCancelReject} />
        ) : (
          <>
            <ReviewStatus snapshot={snapshot} />
            {canWrite && reviewable && (
              <div className="ml-auto flex items-center gap-2 max-sm:w-full">
                {(snapshot.reviewState === "approved" ||
                  snapshot.reviewState === "rejected") && (
                  <button
                    type="button"
                    className={buttonClass("ghost")}
                    onClick={onUndo}
                  >
                    <ArrowCounterClockwiseIcon size={14} />
                    Undo
                    <Kbd>u</Kbd>
                  </button>
                )}
                <button
                  type="button"
                  className={`${buttonClass("danger")} max-sm:flex-1`}
                  disabled={snapshot.reviewState === "rejected"}
                  onClick={onStartReject}
                >
                  Reject
                  <Kbd>r</Kbd>
                </button>
                <button
                  type="button"
                  className={`${buttonClass("primary")} max-sm:flex-1`}
                  disabled={snapshot.reviewState === "approved"}
                  onClick={onApprove}
                >
                  Approve
                  <Kbd inverted>a</Kbd>
                </button>
              </div>
            )}
          </>
        )}
      </div>
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

function ReviewStatus({ snapshot }: { snapshot: Snapshot }) {
  const review = snapshot.lastReview;
  if (snapshot.reviewState === "none") {
    return (
      <span className="text-xs text-muted">
        Matches the baseline, no review needed
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

function RejectForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(comment);
      }}
    >
      <input
        ref={input}
        value={comment}
        maxLength={500}
        onChange={(event) => setComment(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="Why is this change wrong? (optional)"
        aria-label="Reject comment"
        className="h-8 min-w-0 flex-1 rounded-md bg-surface px-2.5 text-sm shadow-[inset_0_0_0_1px_var(--color-field-border)] transition-shadow duration-250 ease-standard outline-none placeholder:text-subtle focus:shadow-field-focus"
      />
      <button type="button" className={buttonClass("ghost")} onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className={buttonClass("danger")}>
        Reject
      </button>
    </form>
  );
}
