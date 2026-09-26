import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import visual from "../../snippets/docs/visual.yml?highlight";

export const Route = createFileRoute("/docs/")({
  head: docsHead(
    "Quickstart",
    "Set up stateofpixel on a GitHub repository in a few minutes.",
  ),
  component: Quickstart,
});

function Quickstart() {
  return (
    <DocsPage
      title="Quickstart"
      lead="Your CI takes the screenshots. stateofpixel compares them with the last approved ones and sets a check on the pull request until someone approves the changes."
    >
      <H2 id="install">1. Install the GitHub App</H2>
      <p>
        Sign in on <Link to="/">stateofpixel.com</Link> and install the GitHub
        App on your account or organization. Pick the repositories to test. Each
        repository becomes a project, and its project page shows the setup steps
        until the first build arrives.
      </p>

      <H2 id="workflow">2. Add the workflow</H2>
      <p>
        Add a step that runs after your tests write their screenshots. This
        example runs Playwright tests that save PNG files into{" "}
        <Code>screenshots</Code>:
      </p>
      <Snip file=".github/workflows/visual.yml" snippet={visual} />
      <ul>
        <li>
          <Code>id-token: write</Code> lets the CLI sign in with the GitHub
          Actions OIDC token, so you do not need a secret.
        </li>
        <li>
          Run it on pushes to <Code>main</Code> too. Builds on your default
          branch are approved on their own and become the baseline that pull
          requests compare against.
        </li>
        <li>
          <Code>fetch-depth: 0</Code> gives the CLI the git history it uses to
          find the baseline. With a shallow clone the server asks the GitHub
          compare API instead.
        </li>
      </ul>
      <p>
        With the Playwright integration you skip the upload step, and with
        Storybook one command captures every story. See{" "}
        <Link to="/docs/playwright">Playwright</Link> and{" "}
        <Link to="/docs/storybook">Storybook</Link>.
      </p>

      <H2 id="first-build">3. Push to main</H2>
      <p>
        The first build has nothing to compare with, so every snapshot is added
        and the build is approved on its own. It becomes the first baseline, and
        the check says "Baseline created".
      </p>

      <H2 id="review">4. Open a pull request</H2>
      <p>
        When a pull request changes how something looks, the{" "}
        <Code>stateofpixel</Code> check waits with "2 changes to review".
        Details opens the build page, where anyone with write access to the
        repository approves or rejects each change. When every change is
        approved, the check turns green. See{" "}
        <Link to="/docs/review">Reviewing changes</Link>.
      </p>

      <H2 id="require">5. Require the check</H2>
      <p>
        The check only blocks merges when GitHub requires it. In the repository
        settings on GitHub, add a branch protection rule or a ruleset for{" "}
        <Code>main</Code> that requires status checks to pass, and pick{" "}
        <Code>stateofpixel</Code>. See{" "}
        <Link to="/docs/checks">The GitHub check</Link> for every state it can
        be in.
      </p>
    </DocsPage>
  );
}
