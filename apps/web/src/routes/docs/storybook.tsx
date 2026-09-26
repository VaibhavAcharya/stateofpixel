import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
  Table,
} from "../../components/docs/DocsLayout";
import filter from "../../snippets/docs/storybook-filter.sh?highlight";
import install from "../../snippets/docs/storybook-install.sh?highlight";
import workflow from "../../snippets/docs/storybook-workflow.yml?highlight";

export const Route = createFileRoute("/docs/storybook")({
  head: docsHead(
    "Storybook",
    "Capture every story of a built Storybook and upload it with one command.",
  ),
  component: Storybook,
});

function Storybook() {
  return (
    <DocsPage
      title="Storybook"
      lead="One command opens every story of a built Storybook in Chromium, takes a screenshot at each width and uploads them."
    >
      <H2 id="install">Install</H2>
      <p>The capture uses the Playwright in your project.</p>
      <Snip file="terminal" snippet={install} />

      <H2 id="ci">Run it on CI</H2>
      <Snip file=".github/workflows/visual.yml" snippet={workflow} />
      <p>
        Keep <Code>id-token: write</Code> and the push trigger on{" "}
        <Code>main</Code> from the <Link to="/docs">Quickstart</Link>.
      </p>
      <p>
        Each story is captured at every width in <Code>--viewports</Code> and
        named <Code>Title/Name [chromium 1280]</Code>, like{" "}
        <Code>Button/Primary [chromium 375]</Code>.
      </p>

      <H2 id="options">Pick stories and wait for them</H2>
      <Snip file="terminal" snippet={filter} />
      <Table
        first={(value) => <Code>{value}</Code>}
        head={["Flag", "Default", "What it does"]}
        rows={[
          [
            "--viewports",
            <Code key="d">1280</Code>,
            "Comma separated viewport widths.",
          ],
          [
            "--include",
            "every story",
            <>
              Only stories whose <Code>Title/Name</Code> matches the glob.{" "}
              <Code>*</Code> stays inside one segment, <Code>**</Code> crosses
              segments.
            </>,
          ],
          [
            "--exclude",
            "none",
            "Skip stories whose Title/Name matches the glob.",
          ],
          [
            "--wait-for-selector",
            <Code key="d">#storybook-root &gt; *</Code>,
            "Wait for this selector before each screenshot.",
          ],
          [
            "--delay",
            <Code key="d">0</Code>,
            "Extra milliseconds to wait before each screenshot.",
          ],
        ]}
      />
      <p>
        <Code>storybook</Code> also takes every flag of <Code>upload</Code>,
        like <Code>--build-name</Code>, <Code>--shard</Code> and{" "}
        <Code>--threshold</Code>. See the <Link to="/docs/cli">CLI</Link>{" "}
        reference. Use <Code>--dry-run</Code> to capture and print the plan
        without uploading.
      </p>
      <p>
        Stories that load data or fonts late are the usual cause of noisy diffs.{" "}
        <Link to="/docs/stable-screenshots">Stable screenshots</Link> has the
        fixes.
      </p>
    </DocsPage>
  );
}
