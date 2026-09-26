import { Link } from "@tanstack/react-router";
import { formatDate } from "../../lib/format";
import { buttonClass, EmptyState } from "../ui";

export function BuildNotFound({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 max-sm:px-4">
      <EmptyState title={title}>
        It may not exist, or you do not have access to the repository on GitHub.
      </EmptyState>
    </div>
  );
}

export type BuildDeletion = {
  branch: string;
  prNumber: number | null;
  reason: "pr_closed" | "branch_inactive";
  retentionDays: number;
  deletedAt: number;
};

export function BuildDeleted({
  owner,
  repo,
  number,
  deletion,
}: {
  owner: string;
  repo: string;
  number: number;
  deletion: BuildDeletion | null;
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 max-sm:px-4">
      <EmptyState
        title="This build was deleted."
        action={
          <Link
            to="/$owner/$repo"
            params={{ owner, repo }}
            className={buttonClass()}
          >
            See builds
          </Link>
        }
      >
        {deletion === null ? (
          <>
            Build {number} was deleted by retention, which removes builds of
            closed pull requests and inactive branches.
          </>
        ) : (
          <>
            Build {number} of <span className="mono">{deletion.branch}</span>{" "}
            was deleted on {formatDate(deletion.deletedAt)},{" "}
            {deletion.reason === "pr_closed" && deletion.prNumber !== null
              ? `${deletion.retentionDays} days after pull request #${deletion.prNumber} closed.`
              : `after the branch had no new build for ${deletion.retentionDays} days.`}
          </>
        )}{" "}
        Repository admins set how long builds are kept under Settings,
        Retention.
      </EmptyState>
    </div>
  );
}
