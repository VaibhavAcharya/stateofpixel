import { createFileRoute, Link } from "@tanstack/react-router";
import { facts } from "../components/docs/facts";
import { LegalPage, SupportEmail } from "../components/LegalPage";
import { PAGES, pageLinks, pageMeta } from "../lib/pageMeta";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy / stateofpixel" },
      ...pageMeta(PAGES.privacy),
    ],
    links: pageLinks(PAGES.privacy),
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="September 28, 2026">
      <p>
        This policy explains what data stateofpixel ("we", "us") collects when
        you use stateofpixel.com, the GitHub App and the stateofpixel CLI, and
        what we do with it. Questions go to <SupportEmail />.
      </p>

      <h2>What we collect</h2>
      <p>When you sign in with GitHub:</p>
      <ul>
        <li>
          Your GitHub user ID, login, name, avatar URL and email address, if
          GitHub shares them.
        </li>
        <li>
          A GitHub access token, used to check which repositories you can read,
          review or administer.
        </li>
        <li>The time you last used the app.</li>
      </ul>
      <p>When you install the GitHub App:</p>
      <ul>
        <li>The login and ID of the GitHub account or organization.</li>
        <li>
          For each repository you select: its ID, owner, name, visibility and
          default branch.
        </li>
      </ul>
      <p>When your CI uploads a build:</p>
      <ul>
        <li>
          The PNG screenshots, their names and SHA-256 hashes, and the diff
          results your runner computed.
        </li>
        <li>
          Git metadata: commit SHA, commit message, branch, base branch, pull
          request number and recent ancestor commits.
        </li>
        <li>The CI provider and the URL of the CI run.</li>
      </ul>
      <p>When you buy a paid plan:</p>
      <ul>
        <li>
          The customer and subscription IDs from our payment provider, the plan,
          the billing period and when it ends. Card details go to the payment
          provider and never reach us.
        </li>
      </ul>
      <p>
        We never receive or run your source code. Screenshots show whatever your
        pages or components render, so do not capture pages that show data you
        are not allowed to share with us.
      </p>
      <p>When you review a build:</p>
      <ul>
        <li>
          Each approve, reject and undo, who made it, and any comment you add.
        </li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>
        The site stores your sign-in session and your theme choice in your
        browser's local storage. We do not use advertising or tracking cookies.
      </p>

      <h2>Analytics</h2>
      <p>
        We use Umami Cloud to count page views and clicks on some buttons, such
        as sign in, copy code and approve. Umami does not use cookies. It
        records the page, the page you came from, your browser, operating
        system, device type, screen size, language, country and page load times.
        Before anything is sent, we replace account names, repository names,
        build numbers and snapshot names in page addresses with placeholders,
        and we leave out search parameters. If your browser sends Do Not Track,
        nothing is sent.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>
          To run the service: store baselines, compare builds and show them.
        </li>
        <li>To set commit statuses on your commits in GitHub.</li>
        <li>To check that you are allowed to see or review a project.</li>
        <li>To reply when you contact us.</li>
      </ul>
      <p>We do not sell your data and we do not use it for advertising.</p>

      <h2>Who processes it</h2>
      <p>We use these providers to run stateofpixel:</p>
      <ul>
        <li>GitHub, for sign-in, the GitHub App and commit statuses.</li>
        <li>
          Convex, for the database, file storage and the backend functions.
        </li>
        <li>Dodo Payments, to take payments for paid plans.</li>
        <li>Netlify, to host the website and store screenshots.</li>
        <li>Umami, for the analytics described above.</li>
      </ul>
      <p>These providers may process data in other countries.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          Builds of pull requests and other branches are deleted after the
          retention period set in the project settings, {facts.retentionDays}{" "}
          days by default, counted from when the pull request closes or the
          branch gets no new builds.
        </li>
        <li>Screenshots and diffs that no build uses any more are deleted.</li>
        <li>
          Deleting a project in its settings deletes its builds, and the images
          that no other project uses.
        </li>
        <li>
          Uninstalling the GitHub App archives your projects. Their data stays
          until you ask us to delete it.
        </li>
        <li>GitHub webhook delivery records are deleted after 7 days.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can ask for a copy of your data, a correction or its deletion by
        writing to <SupportEmail />. We will delete your user and account data
        on request. You can also revoke the app's access at any time in your
        GitHub settings.
      </p>

      <h2>Security</h2>
      <p>
        Data moves over HTTPS. Project tokens are stored as hashes, so we cannot
        show them again after you create them. Access to a project follows your
        permissions on its GitHub repository.
      </p>

      <h2>Children</h2>
      <p>
        stateofpixel is not meant for anyone under 18, and we do not knowingly
        collect their data.
      </p>

      <h2>Changes</h2>
      <p>
        When we change this policy, we update the date at the top of this page.
        For changes that affect how we use your data, we will also tell you by
        email or on the site before they apply. See also the{" "}
        <Link to="/terms">terms</Link> and the{" "}
        <Link to="/refunds">refund policy</Link>.
      </p>
    </LegalPage>
  );
}
