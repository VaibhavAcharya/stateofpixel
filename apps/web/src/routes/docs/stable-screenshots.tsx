import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Code,
  DocsPage,
  docsHead,
  H2,
  Snip,
} from "../../components/docs/DocsLayout";
import compare from "../../snippets/docs/compare.sh?highlight";
import stable from "../../snippets/docs/stable.ts?highlight";

export const Route = createFileRoute("/docs/stable-screenshots")({
  head: docsHead(
    "Stable screenshots",
    "Keep screenshots the same between runs so only real changes need review.",
  ),
  component: StableScreenshots,
});

function StableScreenshots() {
  return (
    <DocsPage
      title="Stable screenshots"
      lead="A snapshot that changes on every run asks for review on every run. Most noise comes from a few causes, and each has a fix."
    >
      <H2 id="environment">Render in the same place</H2>
      <p>
        Screenshots render in your CI, so fonts and anti-aliasing depend on the
        machine. Take them in the same environment every time, for example the
        Playwright Docker image with the same Playwright version as your
        project. Do not mix screenshots from your laptop with screenshots from
        CI.
      </p>

      <H2 id="page">Freeze the page</H2>
      <Snip file="tests/dashboard.spec.ts" snippet={stable} />
      <ul>
        <li>
          <Code>snapshot()</Code> from the{" "}
          <Link to="/docs/playwright">Playwright integration</Link> already
          waits for fonts, disables CSS animations and transitions, and hides
          the caret.
        </li>
        <li>
          Fix the clock with <Code>page.clock</Code> so dates and relative times
          do not change.
        </li>
        <li>Wait for the content you want, not for a fixed time.</li>
        <li>
          Replace random or live data, like avatars, ads and charts of today's
          numbers, with fixed test data, or hide it with CSS before the
          screenshot.
        </li>
        <li>
          For Storybook, use <Code>--wait-for-selector</Code> and{" "}
          <Code>--delay</Code> for stories that render late.
        </li>
      </ul>

      <H2 id="threshold">Tune the threshold</H2>
      <p>
        Two project settings decide when pixels count as changed. Admins find
        them under Settings, Diff:
      </p>
      <ul>
        <li>
          <strong>Threshold</strong>, from 0 to 1, default 0.1. How different a
          pixel's color has to be to count. Higher ignores more.
        </li>
        <li>
          <strong>Count anti-aliased pixels as changes</strong>, off by default.
          Anti-aliased edges are ignored unless you turn it on.
        </li>
      </ul>
      <p>
        <Code>--threshold</Code> on the CLI, or <Code>threshold</Code> on the
        Playwright reporter, overrides the setting for that upload. To try
        values before you change them, compare two folders on your machine:
      </p>
      <Snip file="terminal" snippet={compare} />
    </DocsPage>
  );
}
