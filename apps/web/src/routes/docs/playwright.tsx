import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
  Table,
} from "../../components/docs/DocsLayout";
import install from "../../snippets/docs/playwright-install.sh?highlight";
import reporter from "../../snippets/docs/playwright-reporter.ts?highlight";
import snapshotTest from "../../snippets/docs/playwright-snapshot.ts?highlight";
import workflow from "../../snippets/docs/playwright-workflow.yml?highlight";

export const Route = createFileRoute("/docs/playwright")({
  head: docsHead(
    "Playwright",
    "Take snapshots in Playwright tests and upload them with the stateofpixel reporter.",
  ),
  component: Playwright,
});

function Playwright() {
  return (
    <DocsPage
      title="Playwright"
      lead="Call snapshot() in your tests. The reporter uploads the screenshots when the run ends."
    >
      <H2 id="install">Install</H2>
      <Snip file="terminal" snippet={install} />

      <H2 id="reporter">Add the reporter</H2>
      <Snip file="playwright.config.ts" snippet={reporter} />
      <p>
        The reporter clears <Code>stateofpixel-screenshots</Code> when the run
        begins and uploads it when the run ends. It uploads on CI only, when{" "}
        <Code>CI</Code> is set. A local run leaves the screenshots in the folder
        so you can look at them.
      </p>

      <H2 id="snapshot">Take snapshots</H2>
      <Snip file="tests/pricing.spec.ts" snippet={snapshotTest} />
      <p>
        <Code>snapshot(page, name)</Code> waits for fonts, disables animations,
        hides the caret and saves a full-page screenshot. Pass{" "}
        <Code>{"{ fullPage: false }"}</Code> to capture only the viewport.
      </p>
      <p>
        The browser and viewport width are added to the name, so{" "}
        <Code>Marketing/Pricing</Code> in Chromium at 1280px becomes{" "}
        <Code>Marketing/Pricing [chromium 1280]</Code>. Running the same test in
        several Playwright projects gives one snapshot per browser and width.
        The name is how stateofpixel matches snapshots across builds, so
        renaming a snapshot makes it a new one.
      </p>
      <p>
        Next to each PNG, <Code>snapshot</Code> writes the browser, viewport,
        Playwright project, test file and line. The build page shows them under
        the snapshot.
      </p>

      <H2 id="ci">Run it on CI</H2>
      <Snip file=".github/workflows/visual.yml" snippet={workflow} />
      <p>
        No upload step is needed. The workflow still needs{" "}
        <Code>id-token: write</Code>, as in the{" "}
        <Link to="/docs">Quickstart</Link>. With Playwright sharding (
        <Code>--shard 1/4</Code>), the reporter uploads once per shard and the
        build finishes when the last shard is done.
      </p>
      <p>
        When a test fails, the upload is marked as a subset. Snapshots of tests
        that did not run are then not reported as removed.
      </p>

      <H2 id="options">Reporter options</H2>
      <Table
        first={(value) => <Code>{value}</Code>}
        head={["Option", "What it does"]}
        rows={[
          [
            "buildName",
            <>
              Separate suite with its own baselines and check. See{" "}
              <Link to="/docs/suites">Suites</Link>.
            </>,
          ],
          ["baselineBranch", "Branch to compare against."],
          [
            "threshold",
            "Color difference threshold from 0 to 1. Overrides the project setting.",
          ],
          [
            "subset",
            "Always mark the upload as a subset, so missing snapshots are never removed.",
          ],
          ["strict", "Fail the run when stateofpixel cannot be reached."],
          [
            "uploadOutsideCi",
            "Upload from your machine too. Needs STATEOFPIXEL_TOKEN.",
          ],
          ["nonce", "Id shared by every shard of one build."],
        ]}
      />
      <p>
        <Code>STATEOFPIXEL_DIR</Code> changes the folder that{" "}
        <Code>snapshot</Code> writes to and the reporter uploads.
      </p>
    </DocsPage>
  );
}
