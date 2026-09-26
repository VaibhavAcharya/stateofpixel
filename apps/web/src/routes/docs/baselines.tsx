import { createFileRoute, Link } from "@tanstack/react-router";
import { Code, DocsPage, docsHead, H2 } from "../../components/docs/DocsLayout";

export const Route = createFileRoute("/docs/baselines")({
  head: docsHead(
    "Baselines",
    "How stateofpixel picks the build a new build is compared against.",
  ),
  component: Baselines,
});

function Baselines() {
  return (
    <DocsPage
      title="Baselines"
      lead="A build is compared with the newest approved build in its own git history. Your default branch keeps that history approved."
    >
      <H2 id="pick">How the baseline is picked</H2>
      <ol>
        <li>
          The CLI sends the commit's history, up to 100 commits. The server
          walks it from the newest commit and takes the first build of the same
          suite that was approved or had no changes.
        </li>
        <li>
          If none matches, for example after a shallow clone, the server asks
          GitHub which of the newest builds on the baseline branch are in the
          commit's history, and takes the newest.
        </li>
        <li>
          If there is still none, the build has no baseline. Every snapshot is
          added and the build is approved on its own, so it becomes the first
          baseline. On a pull request the page says "No baseline found for this
          branch. Rebase on main to compare."
        </li>
      </ol>
      <p>
        For a new pull request, the baseline is usually the last build on the
        branch it started from. After you approve a build on the pull request,
        the next push compares with that build, so you only review what changed
        since.
      </p>
      <p>
        Builds uploaded with <Code>--subset</Code> and builds over the storage
        limit are never baselines.
      </p>

      <H2 id="default-branch">The default branch</H2>
      <p>
        Builds on your default branch are approved on their own and become the
        newest baseline. Whatever lands there is the truth, reviewed or not. To
        add other branches, like <Code>release/*</Code>, edit Auto-approve
        branches in the project settings. <Code>*</Code> matches inside one path
        segment and <Code>**</Code> across segments. It applies to builds that
        are not on a pull request.
      </p>

      <H2 id="merges">After a merge</H2>
      <p>
        Squash, rebase and merge commits all work. After a squash or rebase
        merge the new commit on the default branch is not a descendant of the
        pull request, so stateofpixel asks GitHub which pull request it came
        from. The build page shows "From PR #123" with a link to the pull
        request's last build, and marks changes that were never approved on that
        pull request as "not reviewed on PR".
      </p>

      <H2 id="tab">The Baselines tab</H2>
      <p>
        The project's Baselines tab shows the newest approved image of every
        snapshot on the default branch, per suite. Open one to see its history:
        every build where its image changed, and who approved it when that is
        known.
      </p>
      <p>
        See <Link to="/docs/review">Reviewing changes</Link> for how approvals
        carry over between pushes.
      </p>
    </DocsPage>
  );
}
