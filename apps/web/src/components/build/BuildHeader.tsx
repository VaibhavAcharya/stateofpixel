import {
  ArrowsLeftRightIcon,
  ClockIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  InfoIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatCount, shortSha } from "../../lib/format";
import {
  BuildStatePill,
  buttonClass,
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
  onApproveAll,
  onRejectAll,
}: {
  build: Build;
  owner: string;
  repo: string;
  canWrite: boolean;
  canReview: boolean;
  onApproveAll: () => void;
  onRejectAll: () => void;
}) {
  const github = `https://github.com/${owner}/${repo}`;
  const nothingPending = !canReview || build.counts.pending === 0;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold tracking-[-0.01em]">
            <span className="shrink-0 text-muted tabular-nums">
              #{build.number}
            </span>
            <span className="truncate">
              {build.commitMessage || "No commit message"}
            </span>
          </h1>
          <BuildStatePill
            status={build.status}
            conclusion={build.conclusion}
            counts={build.counts}
            shards={build.shards}
            storageBlocked={build.storageBlocked}
          />
          {build.superseded && <SupersededPill />}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <MetaItem icon={GitBranchIcon} label="Branch">
            <Link
              to="/$owner/$repo"
              params={{ owner, repo }}
              search={{ branch: build.branch }}
              className="mono truncate text-text hover:text-link"
            >
              {build.branch}
            </Link>
          </MetaItem>
          <MetaItem icon={GitCommitIcon} label="Commit">
            <a
              href={`${github}/commit/${build.commitSha}`}
              className="mono hover:text-link"
            >
              {shortSha(build.commitSha)}
            </a>
          </MetaItem>
          {build.prNumber !== null && (
            <MetaItem icon={GitPullRequestIcon} label="Pull request">
              <a
                href={`${github}/pull/${build.prNumber}`}
                className="tabular-nums hover:text-link"
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
                  className="text-text tabular-nums hover:text-link"
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
          <>
            <button
              type="button"
              className={`${buttonClass("danger")} max-sm:flex-1`}
              disabled={nothingPending}
              onClick={onRejectAll}
            >
              Reject build
            </button>
            <button
              type="button"
              className={`${buttonClass("primary")} max-sm:flex-1`}
              disabled={nothingPending}
              title="Approve all pending (shift+a)"
              onClick={onApproveAll}
            >
              Approve all
              {build.counts.pending > 0 && (
                <span className="tabular-nums opacity-60">
                  {formatCount(build.counts.pending)}
                </span>
              )}
            </button>
          </>
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
