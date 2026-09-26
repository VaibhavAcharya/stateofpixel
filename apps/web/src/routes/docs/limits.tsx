import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Table,
} from "../../components/docs/DocsLayout";

export const Route = createFileRoute("/docs/limits")({
  head: docsHead(
    "Limits and storage",
    "Limits per build and account, how storage is counted, and how long images are kept.",
  ),
  component: Limits,
});

function Limits() {
  return (
    <DocsPage
      title="Limits and storage"
      lead="Plans are priced by storage only. Builds, snapshots and reviewers are not billed."
    >
      <H2 id="storage">How storage is counted</H2>
      <p>
        Every image is stored once per account, keyed by its content. A snapshot
        that did not change between builds adds nothing, however many builds use
        it. Storage is the size of every stored image: baselines, images from
        pull requests and diff images. The account's Billing tab shows how much
        is used. See{" "}
        <Link to="/" hash="pricing">
          pricing
        </Link>{" "}
        for the plans.
      </p>

      <H2 id="over-limit">When an account is over its limit</H2>
      <ol>
        <li>
          At 80%, the account and project pages show a warning, and the CLI
          prints one.
        </li>
        <li>
          At 100%, a 14 day grace period starts. Everything keeps working, and
          the banner names the day it ends.
        </li>
        <li>
          After the grace period, new images are not stored. Builds still
          report, but changed snapshots are not compared, and the check passes
          with "Storage limit reached, not compared". CI keeps passing.
        </li>
      </ol>
      <p>
        Upgrading, or freeing space with a shorter retention or by deleting a
        project, ends this as soon as usage is back under the limit.
      </p>

      <H2 id="retention">Retention</H2>
      <p>
        Builds of pull requests are deleted a set time after the pull request
        closes, 60 days by default. Builds of branches without a pull request
        are deleted when the branch had no new build for that long. Admins set
        it from 7 to 365 days under Settings, Retention.
      </p>
      <p>
        Builds on the default branch and on auto-approve branches are kept, and
        so is any build that another build uses as its baseline. A daily cleanup
        removes images that no build has used for 24 hours, and frees their
        storage. A link to a deleted build shows "Build not found."
      </p>

      <H2 id="limits">Limits</H2>
      <Table
        head={["Limit", "Value"]}
        rows={[
          ["Snapshots per build", "20,000"],
          ["Shards per build", "256"],
          ["Image size", "20 MB"],
          ["Image dimensions", "10,000 x 50,000 px"],
          ["Snapshot name", "512 characters"],
          ["Metadata per snapshot", "4 KB"],
          ["Time to finish a build", "60 minutes"],
          ["Builds per account", "2,000 a day"],
          ["Uploads per account", "20 GB a day"],
          ["Requests per token", "600 a minute"],
        ]}
      />
      <p>
        Images over the size or dimension limits are rejected, their snapshots
        fail, and <Code>upload</Code> exits 1. Rate limits make the CLI warn and
        exit 0.
      </p>
    </DocsPage>
  );
}
