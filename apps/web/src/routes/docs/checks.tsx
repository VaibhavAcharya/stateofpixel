import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Table,
} from "../../components/docs/DocsLayout";

export const Route = createFileRoute("/docs/checks")({
  head: docsHead(
    "The GitHub check",
    "What the stateofpixel check on a commit means and how to require it.",
  ),
  component: Checks,
});

function Checks() {
  return (
    <DocsPage
      title="The GitHub check"
      lead="Every build sets a commit status on its commit. Details on GitHub opens the build page."
    >
      <H2 id="states">States</H2>
      <Table
        head={["Build", "Check", "Text"]}
        rows={[
          [
            "Shards still uploading",
            "Pending",
            "Waiting for screenshots (2 of 4 shards)",
          ],
          ["Changes to review", "Pending", "12 changes to review"],
          ["Nothing changed", "Success", "No visual changes"],
          ["Every change approved", "Success", "12 changes approved"],
          [
            "First build of a suite",
            "Success",
            "Baseline created, 40 snapshots",
          ],
          ["Default branch", "Success", "Baseline updated, 12 changes"],
          ["A change rejected", "Failure", "2 changes rejected"],
          ["Not finished in 60 minutes", "Error", "Build never finished"],
          ["Upload failed on CI", "Error", "Upload failed, see CI logs"],
          [
            "Over the storage limit",
            "Success",
            "Storage limit reached, not compared",
          ],
        ]}
      />
      <p>
        A build with changes to review stays pending until someone approves or
        rejects them, however long that takes. When the storage limit is
        reached, builds pass without being compared, so CI keeps passing. See{" "}
        <Link to="/docs/limits">Limits and storage</Link>.
      </p>

      <H2 id="name">Check name</H2>
      <p>
        The check is <Code>stateofpixel</Code>. Each extra suite gets its own,
        like <Code>stateofpixel/storybook</Code>. See{" "}
        <Link to="/docs/suites">Suites</Link>.
      </p>

      <H2 id="require">Require it</H2>
      <p>
        The CLI exits 0 when there are changes, so the CI job passes and the
        check decides. It blocks a merge only when GitHub requires it:
      </p>
      <ol>
        <li>
          Open the repository's settings on GitHub and add a branch protection
          rule or a ruleset for your default branch.
        </li>
        <li>
          Turn on required status checks and add <Code>stateofpixel</Code>, plus
          the check of each suite that should block.
        </li>
      </ol>
      <p>
        A pending check blocks the merge too, so a pull request with changes
        nobody reviewed cannot merge. Changes that land without review still
        become the baseline on the default branch. See{" "}
        <Link to="/docs/baselines">Baselines</Link>.
      </p>

      <H2 id="permissions">GitHub App permissions</H2>
      <p>
        The app needs Commit statuses write to set the check, Pull requests read
        for the pull request number and base branch, Contents read for the
        compare API, and Metadata read, which every app has.
      </p>
    </DocsPage>
  );
}
