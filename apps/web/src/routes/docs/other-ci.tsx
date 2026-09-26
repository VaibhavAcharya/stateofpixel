import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import otherCi from "../../snippets/docs/other-ci.sh?highlight";

export const Route = createFileRoute("/docs/other-ci")({
  head: docsHead(
    "Other CI",
    "Run stateofpixel on CI other than GitHub Actions with a project token.",
  ),
  component: OtherCi,
});

function OtherCi() {
  return (
    <DocsPage
      title="Other CI"
      lead="Outside GitHub Actions, the CLI signs in with a project token instead of the OIDC token."
    >
      <H2 id="token">Create a token</H2>
      <p>
        Repository admins open the project on stateofpixel.com, then Settings,
        Tokens, and create a token. It starts with <Code>sop_</Code> and is
        shown once, so copy it into your CI's secrets right away. Tokens can be
        revoked from the same place, which also shows when each one was last
        used.
      </p>

      <H2 id="run">Run the CLI</H2>
      <p>
        Set the token as <Code>STATEOFPIXEL_TOKEN</Code> and run the same
        commands as on GitHub Actions:
      </p>
      <Snip file="ci.sh" snippet={otherCi} />

      <H2 id="git">Git information</H2>
      <p>
        On other CI the CLI reads the commit, branch and history from the local
        checkout:
      </p>
      <ul>
        <li>
          Check out the branch by name. On a detached <Code>HEAD</Code> the
          branch is recorded as <Code>HEAD</Code>.
        </li>
        <li>
          Fetch enough history to reach your default branch. When the baseline
          is not in the local history, the server asks the GitHub compare API.
        </li>
        <li>
          The baseline branch is <Code>origin/HEAD</Code>, or <Code>main</Code>{" "}
          when that is not set. Pass <Code>--baseline-branch</Code> to pick
          another one.
        </li>
        <li>
          The commit has to be on GitHub, because the check is set on it there.
        </li>
      </ul>
      <p>
        The pull request number comes from the GitHub Actions event, so on other
        CI builds are linked to their branch and commit only. A new push does
        not carry over approvals from the last build, and builds are not marked
        superseded.
      </p>

      <H2 id="shards">Shards</H2>
      <p>
        GitHub Actions gives every job of a run the same id. Elsewhere, set{" "}
        <Code>STATEOFPIXEL_NONCE</Code> to an id your CI shares between the jobs
        of one run. See <Link to="/docs/sharding">Sharding</Link>.
      </p>
    </DocsPage>
  );
}
