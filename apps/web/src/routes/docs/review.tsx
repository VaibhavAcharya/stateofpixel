import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  DocsPage,
  docsHead,
  H2,
  Table,
} from "../../components/docs/DocsLayout";
import { SHORTCUT_GROUPS } from "../../components/ShortcutsDialog";
import { Kbd } from "../../components/ui";

export const Route = createFileRoute("/docs/review")({
  head: docsHead(
    "Reviewing changes",
    "Compare, approve and reject visual changes on the build page.",
  ),
  component: Review,
});

function Review() {
  return (
    <DocsPage
      title="Reviewing changes"
      lead="Every build has a page that lists its snapshots next to the baseline. The check on the pull request links to it."
    >
      <H2 id="build-page">The build page</H2>
      <p>
        The sidebar groups snapshots into Changed, Added, Removed, Failed and
        Unchanged. The first changed snapshot opens when the page loads, and
        each snapshot has its own link you can share.
      </p>
      <ul>
        <li>
          <strong>Changed</strong>: pixels differ from the baseline above the
          threshold, or the size changed.
        </li>
        <li>
          <strong>Added</strong>: the baseline has no snapshot with this name.
        </li>
        <li>
          <strong>Removed</strong>: the baseline has it and this build does not.
          Removed snapshots never need review.
        </li>
        <li>
          <strong>Failed</strong>: the upload or the diff failed on CI. A build
          with a failed snapshot cannot pass, so push again after fixing the
          cause.
        </li>
      </ul>

      <H2 id="compare">Compare</H2>
      <ul>
        <li>
          <strong>Side by side</strong>: baseline left, new right, with the diff
          drawn over the new image. Press <Kbd>d</Kbd> to hide it.
        </li>
        <li>
          <strong>Diff</strong>: the new image with the changed pixels in red.
        </li>
        <li>
          <strong>Slider</strong>: drag a handle to wipe between the two.
        </li>
        <li>
          <strong>Flip</strong>: one frame that switches between baseline and
          new when you press <Kbd>space</Kbd>. The best mode for 1 pixel shifts.
        </li>
      </ul>
      <p>
        Images show at Fit by default. Switch to 100% or 200% to see real
        pixels. When the sizes differ, both images align at the top left.
      </p>

      <H2 id="approve">Approve and reject</H2>
      <p>
        Anyone with write access to the repository on GitHub can review.
        Everyone with read access can open the page. There are no seats.
      </p>
      <ul>
        <li>
          Approve a snapshot with <Kbd>a</Kbd>, which also moves to the next
          pending one, or approve every pending snapshot with Approve all.
        </li>
        <li>
          Reject with <Kbd>r</Kbd> and an optional comment. One rejection makes
          the check fail with "1 change rejected".
        </li>
        <li>
          Undo a review with <Kbd>u</Kbd>.
        </li>
      </ul>
      <p>
        When every change is approved, the check turns green on GitHub. See{" "}
        <Link to="/docs/checks">The GitHub check</Link>.
      </p>

      <H2 id="new-pushes">New pushes</H2>
      <p>
        A new push on the pull request makes a new build, and the older build is
        marked superseded, with a link to the newest one. Approvals carry over:
        if an image was approved in an earlier build of the same pull request
        and suite, it is approved again, and the page says who approved it and
        in which build. So a rebase does not ask you to review the same pixels
        twice.
      </p>
      <p>
        Rejections do not carry over. A rejected image that shows up again is
        pending, with a note that it was rejected before.
      </p>

      <H2 id="shortcuts">Keyboard shortcuts</H2>
      <p>
        Press <Kbd>?</Kbd> on the build page to see them.
      </p>
      <Table
        head={["Action", "Keys"]}
        rows={SHORTCUT_GROUPS.flatMap((group) =>
          group.items.map(([action, keys]): [string, ReactNode] => [
            action,
            <span key={action} className="inline-flex gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>,
          ]),
        )}
      />
    </DocsPage>
  );
}
