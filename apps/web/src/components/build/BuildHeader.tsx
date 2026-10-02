import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CheckIcon,
  ClockIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  InfoIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatCount, shortSha } from "../../lib/format";
import {
  BuildStatePill,
  PrStatePill,
  RelativeTime,
  Spinner,
  SupersededPill,
} from "../ui";

import type { Build } from "./types";

function MetaItem({
  icon: IconComponent,
  label,
  children,
}: {
  icon: typeof GitBranchIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5" title={label}>
      <IconComponent size={14} className="shrink-0 text-subtle" />
      {children}
    </span>
  );
}

export function BuildHeader({
  build,
  owner,
  repo,
  canWrite,
  canReview,
  links = true,
  headings = true,
  onApproveAll,
  onRejectAll,
  onUndoAll,
}: {
  build: Build;
  owner: string;
  repo: string;
  canWrite: boolean;
  canReview: boolean;
  links?: boolean;
  headings?: boolean;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onUndoAll: () => void;
}) {
  const github = `https://github.com/${owner}/${repo}`;
  const Title = headings ? "h1" : "p";

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Title className="flex min-w-0 items-baseline gap-2 text-lg font-semibold tracking-[-0.01em]">
            <span className="shrink-0 text-muted tabular-nums">
              #{build.number}
            </span>
            <span className="truncate">
              {build.commitMessage || "No commit message"}
            </span>
          </Title>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={build.shards}
            storageBlocked={build.storageBlocked}
          />
          {build.superseded && <SupersededPill />}
          <PrStatePill state={build.prState} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <MetaItem icon={GitBranchIcon} label="Branch">
            <Link
              to="/$owner/$repo"
              params={{ owner, repo }}
              search={{ branch: build.branch }}
              disabled={!links}
              className="mono truncate text-text [&[href]]:hover:text-link"
            >
              {build.branch}
            </Link>
          </MetaItem>
          <MetaItem icon={GitCommitIcon} label="Commit">
            <a
              href={links ? `${github}/commit/${build.commitSha}` : undefined}
              className="mono [&[href]]:hover:text-link"
            >
              {shortSha(build.commitSha)}
            </a>
          </MetaItem>
          {build.prNumber !== null && (
            <MetaItem icon={GitPullRequestIcon} label="Pull request">
              <a
                href={links ? `${github}/pull/${build.prNumber}` : undefined}
                className="tabular-nums [&[href]]:hover:text-link"
              >
                #{build.prNumber}
              </a>
            </MetaItem>
          )}
          <MetaItem icon={ArrowsLeftRightIcon} label="Baseline">
            {build.baseline === null ? (
              "First build, no baseline"
            ) : (
              <span>
                vs{" "}
                <Link
                  to="/$owner/$repo/builds/$number"
                  params={{
                    owner,
                    repo,
                    number: String(build.baseline.number),
                  }}
                  disabled={!links}
                  className="text-text tabular-nums [&[href]]:hover:text-link"
                >
                  #{build.baseline.number}
                </Link>{" "}
                on <span className="mono">{build.baseline.branch}</span>
              </span>
            )}
          </MetaItem>
          <MetaItem icon={ClockIcon} label="Created">
            <RelativeTime timestamp={build.createdAt} />
          </MetaItem>
        </div>
      </div>
      <div className="flex items-center gap-2 empty:hidden max-sm:w-full">
        {build.status !== "finalized" ? null : canWrite ? (
          <VerdictSwitch
            counts={build.counts}
            canReview={canReview}
            buildAction={build.buildAction}
            onApprove={onApproveAll}
            onReject={onRejectAll}
            onUndo={onUndoAll}
          />
        ) : (
          <span className="text-xs text-muted">
            You need write access on GitHub to review
          </span>
        )}
      </div>
    </header>
  );
}

export function Banners({
  build,
  owner,
  repo,
}: {
  build: Build;
  owner: string;
  repo: string;
}) {
  const banners: {
    key: string;
    tone: string;
    icon: ReactNode;
    content: ReactNode;
  }[] = [];
  if (build.supersededBy !== null) {
    banners.push({
      key: "superseded",
      tone: "bg-unchanged-bg",
      icon: <InfoIcon size={16} className="text-unchanged" />,
      content: (
        <>
          A newer build exists for this PR.{" "}
          <Link
            to="/$owner/$repo/builds/$number"
            params={{ owner, repo, number: String(build.supersededBy) }}
            className="font-medium text-link"
          >
            Open #{build.supersededBy}
          </Link>
        </>
      ),
    });
  }
  if (build.mergedPr !== null) {
    const { mergedPr } = build;
    banners.push({
      key: "merged-pr",
      tone: "bg-unchanged-bg",
      icon: <GitPullRequestIcon size={16} className="text-unchanged" />,
      content: (
        <>
          From PR{" "}
          <a
            href={`https://github.com/${owner}/${repo}/pull/${mergedPr.number}`}
            className="font-medium text-link"
          >
            #{mergedPr.number}
          </a>
          {mergedPr.lastBuildNumber !== null && (
            <>
              . Its last build is{" "}
              <Link
                to="/$owner/$repo/builds/$number"
                params={{
                  owner,
                  repo,
                  number: String(mergedPr.lastBuildNumber),
                }}
                className="font-medium text-link"
              >
                #{mergedPr.lastBuildNumber}
              </Link>
            </>
          )}
          .
        </>
      ),
    });
  }
  if (build.status === "pending") {
    banners.push({
      key: "pending",
      tone: "bg-added-bg",
      icon: <Spinner size={16} className="text-added" />,
      content:
        build.shards.total === null || build.shards.total === 1
          ? "Waiting for screenshots. This page updates by itself."
          : `Waiting for screenshots, ${build.shards.done} of ${build.shards.total} shards done. This page updates by itself.`,
    });
  }
  if (build.status === "expired") {
    banners.push({
      key: "expired",
      tone: "bg-unchanged-bg",
      icon: <ClockIcon size={16} className="text-unchanged" />,
      content: "This build never finished.",
    });
  }
  if (build.storageBlocked && build.conclusion !== "no_changes") {
    banners.push({
      key: "storage",
      tone: "bg-failed-bg",
      icon: <WarningIcon size={16} className="text-failed" />,
      content:
        "The account was over its storage limit, so new images were not stored and changes were not compared.",
    });
  }
  if (build.status === "error") {
    banners.push({
      key: "error",
      tone: "bg-failed-bg",
      icon: <WarningIcon size={16} className="text-failed" />,
      content: build.ciRunUrl ? (
        <>
          Upload failed.{" "}
          <a href={build.ciRunUrl} className="font-medium text-link">
            See CI logs
          </a>
        </>
      ) : (
        "Upload failed, see CI logs."
      ),
    });
  }
  if (banners.length === 0) {
    return null;
  }
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-surface px-4 py-2">
      {banners.map((banner) => (
        <p
          key={banner.key}
          className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm ${banner.tone}`}
        >
          <span className="shrink-0">{banner.icon}</span>
          <span>{banner.content}</span>
        </p>
      ))}
    </div>
  );
}

const VERDICT_POSITION = { reject: 0, none: 1, approve: 2 } as const;

function VerdictSwitch({
  counts,
  canReview,
  buildAction,
  onApprove,
  onReject,
  onUndo,
}: {
  counts: Build["counts"];
  canReview: boolean;
  buildAction: "approve" | "reject" | null;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const { pending, approved, rejected } = counts;
  const total = pending + approved + rejected;
  const share = (value: number) =>
    `${total === 0 ? 0 : (value / total) * 100}%`;
  const segment =
    "relative z-10 flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-default";
  const idle = pending === 0 && buildAction === null;

  return (
    <fieldset
      aria-label="Review the whole build"
      className="relative m-0 grid w-[400px] grid-cols-3 overflow-hidden rounded-control border-0 bg-surface-2 p-0.5 max-sm:w-full"
    >
      <span
        aria-hidden
        className="absolute top-0.5 left-0.5 h-7 w-[calc((100%-4px)/3)] rounded-[9px] bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] transition-[translate] duration-200 ease-out-strong motion-reduce:transition-none"
        style={{
          translate: `${VERDICT_POSITION[buildAction ?? "none"] * 100}% 0`,
        }}
      />
      <button
        type="button"
        aria-pressed={buildAction === "reject"}
        disabled={!canReview || buildAction === "reject" || idle}
        onClick={onReject}
        className={`${segment} ${buildAction === "reject" ? "text-rejected" : "text-muted not-disabled:hover:text-rejected"}`}
      >
        <XIcon size={14} weight="bold" />
        Reject build
      </button>
      <button
        type="button"
        disabled={!canReview || buildAction === null}
        onClick={onUndo}
        className={`${segment} pb-1 ${buildAction === null ? "text-text" : "text-muted hover:text-text"}`}
      >
        {buildAction === null ? (
          <span className="tabular-nums">
            {pending > 0 ? `${formatCount(pending)} to review` : "All reviewed"}
          </span>
        ) : (
          <>
            <ArrowCounterClockwiseIcon size={14} />
            Undo
          </>
        )}
        <span
          aria-hidden
          className="absolute inset-x-4 bottom-[3px] flex h-0.5 overflow-hidden rounded-full bg-field-border/30"
        >
          <span
            className="bg-rejected transition-[width] duration-250 ease-out-strong"
            style={{ width: share(rejected) }}
          />
          <span
            className="bg-approved transition-[width] duration-250 ease-out-strong"
            style={{ width: share(approved) }}
          />
        </span>
      </button>
      <button
        type="button"
        aria-pressed={buildAction === "approve"}
        title="Approve every pending snapshot (shift+a)"
        disabled={!canReview || buildAction === "approve" || idle}
        onClick={onApprove}
        className={`${segment} ${buildAction === "approve" ? "text-approved" : "text-muted not-disabled:hover:text-approved"}`}
      >
        <CheckIcon size={14} weight="bold" />
        Approve build
      </button>
    </fieldset>
  );
}
