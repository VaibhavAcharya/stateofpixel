import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import suites from "../../snippets/docs/suites.yml?highlight";

export const Route = createFileRoute("/docs/suites")({
  head: docsHead(
    "Suites",
    "Run separate visual suites in one repository, each with its own baselines and check.",
  ),
  component: Suites,
});

function Suites() {
  return (
    <DocsPage
      title="Suites"
      lead="One repository can run several suites, like end-to-end tests and Storybook. Each suite has its own baselines and its own check."
    >
      <H2 id="name">Name the suite</H2>
      <p>
        Pass <Code>--build-name</Code> to <Code>upload</Code> or{" "}
        <Code>storybook</Code>, or <Code>buildName</Code> to the{" "}
        <Link to="/docs/playwright">Playwright reporter</Link>:
      </p>
      <Snip file=".github/workflows/visual.yml" snippet={suites} />
      <p>
        Without a name the suite is <Code>default</Code> and its check is{" "}
        <Code>stateofpixel</Code>. Other suites report as{" "}
        <Code>stateofpixel/&lt;name&gt;</Code>, like{" "}
        <Code>stateofpixel/storybook</Code>. Require each one on GitHub if it
        should block merges.
      </p>

      <H2 id="baselines">Baselines per suite</H2>
      <p>
        Snapshots only compare with the same suite, so the same snapshot name in
        two suites never collides. Run every suite on pushes to your default
        branch too, so each one gets its own baseline.
      </p>
    </DocsPage>
  );
}
