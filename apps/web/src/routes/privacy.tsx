import { createFileRoute, Link } from "@tanstack/react-router";
import { facts } from "../components/docs/facts";
import { LegalPage, SupportEmail } from "../components/LegalPage";
import { setAdsConsent } from "../lib/ads";
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
    <LegalPage title="Privacy policy" updated="October 10, 2026">
      <p>
        This policy explains what data stateofpixel ("we", "us") collects when
        you use stateofpixel.com, the GitHub App and the stateofpixel CLI, and
        what we do with it. Questions go to <SupportEmail />.
      </p>

      <h2>What we collect</h2>
      <p>When you sign in with GitHub:</p>
      <ul>
        <li>
          Your email address, name and avatar URL, if the provider shares them.
        </li>
        <li>The time you last used the app.</li>
      </ul>
      <p>When you connect your GitHub account:</p>
      <ul>
        <li>Your GitHub user ID and login.</li>
        <li>
          A GitHub access token and the refresh token that renews it, stored
          encrypted and used to check which repositories you can read, review or
          administer.
        </li>
        <li>
          Your permission on each repository and your role in each account, as
          GitHub reports them, to decide what you can see and do.
        </li>
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
        <li>Metadata your tests attach to snapshots in .meta.json files.</li>
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
        <li>Each approve, reject and undo, and who made it.</li>
        <li>Each comment you leave on a snapshot, and who left it.</li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>
        Signing in sets two cookies, nf_jwt and nf_refresh, that keep you signed
        in. The site also keeps your session, your theme choice and the page to
        return to after sign-in in your browser's storage. If you allow cookies
        in the cookie banner, Google Ads sets cookies such as _gcl_au that link
        a sign-up to the ad you clicked. If you decline, it sets none. We keep
        your choice in your browser's storage.
      </p>
      <p>
        <button
          type="button"
          className="text-link hover:underline"
          onClick={() => setAdsConsent(null)}
        >
          Change your cookie choice
        </button>
      </p>

      <h2>Analytics</h2>
      <p>
        We use Umami Cloud to count page views and clicks on some buttons, such
        as sign in, copy code and approve. Umami does not use cookies. It
        records the page, the page you came from, your browser, operating
        system, device type, screen size, language, country and page load times.
        Before anything is sent, we replace account names, repository names,
        build numbers and snapshot names in page addresses with placeholders. We
        keep search parameters on public pages and leave them out on pages
        behind sign-in. If your browser sends Do Not Track, nothing is sent.
      </p>

      <h2>Advertising</h2>
      <p>
        We use Google Ads to measure which of our ads bring sign-ups. When you
        open a public page, such as the home page, the docs or a comparison, the
        site tells Google Ads which page it was. When you sign up, it tells
        Google Ads that a sign-up happened. We do not send your name, email
        address or GitHub account, and pages behind sign-in are not reported. If
        you decline cookies, Google still learns about these visits and
        sign-ups, without cookies.
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
      <p>
        We do not sell your data. Apart from the sign-up measurement above, we
        do not use it for advertising.
      </p>

      <h2>Who processes it</h2>
      <p>We use these providers to run stateofpixel:</p>
      <ul>
        <li>GitHub, for sign-in, the GitHub App and commit statuses.</li>
        <li>Google, for sign-in and Google Ads.</li>
        <li>Dodo Payments, to take payments for paid plans.</li>
        <li>
          Netlify, to host the website, run sign-in and the database, and store
          screenshots.
        </li>
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
        on request, including your sign-in record. You can also revoke the app's
        access at any time in your GitHub settings.
      </p>

      <h2>Security</h2>
      <p>
        Data moves over HTTPS. Project tokens are stored as hashes, so we cannot
        show them again after you create them. GitHub tokens are stored
        encrypted. Access to a project follows your permissions on its GitHub
        repository.
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
