import { createFileRoute, Link } from "@tanstack/react-router";
import { CodeBlock } from "../../components/CodeBlock";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Table,
} from "../../components/docs/DocsLayout";

export const Route = createFileRoute("/docs/cli")({
  head: docsHead(
    "CLI",
    "Commands, flags, environment variables and exit codes of the stateofpixel CLI.",
  ),
  component: Cli,
});

const OUTPUT = `stateofpixel  build #411  feat/header vs main (#405)
  1,500 snapshots  1,488 unchanged  10 changed  2 added  1 removed
  uploaded 22 images (1.3 MB) in 2.1 s
  review: https://stateofpixel.com/acme/web-app/builds/411`;

const FLAG_ENV: Record<string, string> = {
  "--build-name <name>": "STATEOFPIXEL_BUILD_NAME",
  "--shard <i/n>": "STATEOFPIXEL_SHARD",
  "--nonce <id>": "STATEOFPIXEL_NONCE",
  "--baseline-branch <branch>": "STATEOFPIXEL_BASELINE_BRANCH",
};

function FlagCell({ name }: { name: string }) {
  const env = FLAG_ENV[name];
  return (
    <span className="flex flex-col items-start gap-1">
      <Code>{name}</Code>
      {env !== undefined && (
        <span className="mono text-xs text-muted">{env}</span>
      )}
    </span>
  );
}

function Cli() {
  return (
    <DocsPage
      title="CLI"
      lead="The stateofpixel package on npm. Node 20 or newer. Run npx stateofpixel <command> --help for the same list."
    >
      <H2 id="commands">Commands</H2>
      <Table
        first={(value) => <Code>{value}</Code>}
        head={["Command", "What it does"]}
        rows={[
          [
            "upload <dir>",
            "Hash a folder of PNGs, upload the new ones, diff them with the baseline and report the build.",
          ],
          [
            "storybook <static-dir>",
            <>
              Capture every story of a built Storybook, then upload. See{" "}
              <Link to="/docs/storybook">Storybook</Link>.
            </>,
          ],
          [
            "finalize",
            <>
              Finish a build whose shards ran with <Code>--shard auto</Code>.
              See <Link to="/docs/sharding">Sharding</Link>.
            </>,
          ],
          [
            "compare <dir> <baseline-dir>",
            "Compare two folders on your machine and write an HTML report. No account needed.",
          ],
        ]}
      />

      <H2 id="upload">upload and storybook</H2>
      <Table
        first={(name) => <FlagCell name={name} />}
        head={["Flag", "What it does"]}
        rows={[
          [
            "--build-name <name>",
            <>
              The suite, default <Code>default</Code>. See{" "}
              <Link to="/docs/suites">Suites</Link>.
            </>,
          ],
          [
            "--shard <i/n>",
            <>
              This shard and the total, like <Code>2/4</Code>, or{" "}
              <Code>auto</Code> with a finalize step. Default <Code>1/1</Code>.
            </>,
          ],
          [
            "--nonce <id>",
            "Shared by every shard of one build. On GitHub Actions it is the run id plus the attempt.",
          ],
          [
            "--baseline-branch <branch>",
            "Branch to compare against. Default is the pull request's base, else the default branch.",
          ],
          [
            "--subset",
            "Only some snapshots ran, so do not mark the missing ones removed.",
          ],
          [
            "--threshold <number>",
            "Color difference threshold from 0 to 1. Overrides the project setting.",
          ],
          [
            "--strict",
            "Exit 1 when stateofpixel is down or rate limits the request.",
          ],
          [
            "--dry-run",
            "Hash, or capture for storybook, and print the plan. Uploads nothing.",
          ],
        ]}
      />
      <p>
        <Code>storybook</Code> also takes <Code>--viewports</Code>,{" "}
        <Code>--include</Code>, <Code>--exclude</Code>,{" "}
        <Code>--wait-for-selector</Code> and <Code>--delay</Code>.
      </p>

      <H2 id="finalize">finalize</H2>
      <p>
        Takes <Code>--build-name</Code>, <Code>--nonce</Code>,{" "}
        <Code>--baseline-branch</Code> and <Code>--strict</Code>, with the same
        values the shards used, plus <Code>--skip-if-empty</Code> to report a
        build with no changes when no shard ran.
      </p>

      <H2 id="compare">compare</H2>
      <p>
        Takes <Code>--out &lt;dir&gt;</Code> (default{" "}
        <Code>stateofpixel-report</Code>), <Code>--threshold</Code> (default
        0.1) and <Code>--include-aa</Code> to count anti-aliased pixels as
        changes.
      </p>

      <H2 id="auth">Authentication</H2>
      <p>
        On GitHub Actions the CLI uses the OIDC token, which needs{" "}
        <Code>permissions: id-token: write</Code>. Anywhere else, set{" "}
        <Code>STATEOFPIXEL_TOKEN</Code> to a project token. See{" "}
        <Link to="/docs/other-ci">Other CI</Link>.
      </p>

      <H2 id="output">Output</H2>
      <CodeBlock fileName="terminal" code={OUTPUT} />

      <H2 id="exit-codes">Exit codes</H2>
      <ul>
        <li>
          <strong>0</strong> when the build was reported, with or without
          changes. The GitHub check decides whether the pull request can merge.
        </li>
        <li>
          <strong>0</strong> with a warning when stateofpixel is down or a rate
          limit is hit, so an outage does not break your CI. Pass{" "}
          <Code>--strict</Code> to exit 1 instead.
        </li>
        <li>
          <strong>1</strong> on configuration and authentication errors, failed
          uploads, and images over the <Link to="/docs/limits">limits</Link>.
        </li>
      </ul>
    </DocsPage>
  );
}
