import { createFileRoute, Link } from "@tanstack/react-router";
import { CodeBlock } from "../../components/CodeBlock";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import compare from "../../snippets/docs/compare.sh?highlight";
import meta from "../../snippets/docs/folder-meta.json?highlight";

export const Route = createFileRoute("/docs/any-screenshots")({
  head: docsHead(
    "Any screenshots",
    "Upload a folder of PNG files from any test runner.",
  ),
  component: AnyScreenshots,
});

const TREE = `screenshots/
  header.png                      header
  checkout/empty-cart.png         checkout/empty-cart
  checkout/empty-cart.meta.json   metadata for checkout/empty-cart`;

function AnyScreenshots() {
  return (
    <DocsPage
      title="Any screenshots"
      lead="Anything that writes PNG files works: Cypress, BackstopJS, a script, or screenshots of a native app."
    >
      <H2 id="upload">Upload a folder</H2>
      <p>
        Run <Code>npx stateofpixel upload screenshots</Code> after the step that
        writes the files, as in the <Link to="/docs">Quickstart</Link>. The CLI
        hashes every PNG and uploads only the images the server does not have
        yet.
      </p>

      <H2 id="names">Snapshot names</H2>
      <p>
        A snapshot's name is its path inside the folder without{" "}
        <Code>.png</Code>:
      </p>
      <CodeBlock fileName="screenshots" code={TREE} />
      <p>
        The name is how stateofpixel matches a snapshot with the same snapshot
        in the baseline. Keep names stable between runs. Renaming a file makes
        it a new snapshot, and the old one shows as removed. If you capture
        several browsers or widths, put them in the name, like{" "}
        <Code>header [chromium 1280].png</Code>.
      </p>

      <H2 id="metadata">Metadata</H2>
      <p>
        A <Code>.meta.json</Code> file next to a PNG is sent as that snapshot's
        metadata and shown on the build page. It is for display only and never
        changes how snapshots match. Up to 4 KB per snapshot.
      </p>
      <Snip file="checkout/empty-cart.meta.json" snippet={meta} />

      <H2 id="partial">Partial runs</H2>
      <p>
        When only some tests ran, pass <Code>--subset</Code>. Snapshots that are
        missing from the folder are then not reported as removed.
      </p>

      <H2 id="local">Compare on your machine</H2>
      <p>
        <Code>compare</Code> diffs two folders and writes an HTML report. It
        needs no account and uploads nothing.
      </p>
      <Snip file="terminal" snippet={compare} />
    </DocsPage>
  );
}
