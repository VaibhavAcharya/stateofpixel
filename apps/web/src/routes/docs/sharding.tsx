import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import otherCiShards from "../../snippets/docs/other-ci-shards.sh?highlight";
import shardsAuto from "../../snippets/docs/shards-auto.yml?highlight";
import shardsKnown from "../../snippets/docs/shards-known.yml?highlight";

export const Route = createFileRoute("/docs/sharding")({
  head: docsHead(
    "Sharding",
    "Split a visual test run across CI jobs and get one build and one check.",
  ),
  component: Sharding,
});

function Sharding() {
  return (
    <DocsPage
      title="Sharding"
      lead="Several CI jobs can upload parts of one build. The check reports once, after the last part."
    >
      <H2 id="known">When you know the shard count</H2>
      <p>
        Each job passes its shard and the total. The first job to upload creates
        the build, the others join it, and the build finishes when every shard
        is done.
      </p>
      <Snip file=".github/workflows/visual.yml" snippet={shardsKnown} />
      <p>
        While shards upload, the check says "Waiting for screenshots (2 of 4
        shards)". The <Link to="/docs/playwright">Playwright reporter</Link>{" "}
        reads Playwright's own <Code>--shard</Code>, so with it you skip the
        upload step.
      </p>

      <H2 id="auto">When you do not</H2>
      <p>
        Each job uploads with <Code>--shard auto</Code>, and one last job calls{" "}
        <Code>finalize</Code>:
      </p>
      <Snip file=".github/workflows/visual.yml" snippet={shardsAuto} />
      <p>
        <Code>--skip-if-empty</Code> makes <Code>finalize</Code> report a build
        with no changes when no shard ran, so the check still reports.
      </p>

      <H2 id="nonce">How shards find each other</H2>
      <p>
        Shards of one build share a nonce. On GitHub Actions it is the run id
        plus the attempt, so every job of a run joins the same build, and a
        re-run starts a fresh build instead of mixing with the old one.
        Elsewhere, set it yourself:
      </p>
      <Snip file="ci.sh" snippet={otherCiShards} />

      <H2 id="timeout">Builds that never finish</H2>
      <p>
        A build that is not finished 60 minutes after its first shard expires.
        The check shows "Build never finished". A build takes up to 256 shards.
      </p>
    </DocsPage>
  );
}
