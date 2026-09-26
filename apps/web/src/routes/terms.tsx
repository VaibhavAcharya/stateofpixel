import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, SupportEmail } from "../components/LegalPage";
import { PAGES, pageLinks, pageMeta } from "../lib/pageMeta";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and conditions / stateofpixel" },
      ...pageMeta(PAGES.terms),
    ],
    links: pageLinks(PAGES.terms),
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms and conditions" updated="September 25, 2026">
      <p>
        These terms cover your use of stateofpixel.com, the stateofpixel GitHub
        App and the stateofpixel CLI (the "service"). stateofpixel ("we", "us")
        runs the service. By using the service you agree to these terms. If you
        use it for an organization, you agree on its behalf and confirm you are
        allowed to.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be 18 or older and have a GitHub account. You are responsible
        for what happens under your account and your project tokens. Keep tokens
        secret and revoke any that leak.
      </p>

      <h2>Your content</h2>
      <p>
        You keep all rights to the screenshots and data you upload. You give us
        permission to store, copy, compare and display them only to run the
        service for you and the people with access to your projects. You confirm
        that you have the right to upload them.
      </p>

      <h2>Acceptable use</h2>
      <p>Do not use the service to:</p>
      <ul>
        <li>Upload anything illegal, or content you have no right to share.</li>
        <li>Upload malware or files that are not screenshots.</li>
        <li>
          Overload, probe or attack the service, or get around its limits.
        </li>
        <li>Access projects or data you have no permission for.</li>
        <li>Resell the service without our written permission.</li>
      </ul>

      <h2>Plans and payment</h2>
      <p>
        The free plan costs nothing. Paid plans, when offered, are subscriptions
        for a fixed amount of storage, billed in advance each month or each
        year, at the prices on the{" "}
        <Link to="/" hash="pricing">
          pricing section
        </Link>{" "}
        when the period starts. Yearly billing costs 10% less than twelve
        monthly payments. Subscriptions renew until you cancel. Prices do not
        include taxes, which are added where the law requires. We will tell you
        at least 30 days before a price change applies to you. Refunds follow
        the <Link to="/refunds">refund policy</Link>.
      </p>

      <h2>Limits</h2>
      <p>
        Each plan has limits on storage and usage. When an account goes over its
        limit, we may stop storing new images until it is back under the limit
        or upgrades.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep the service running, but we do not promise it will be
        available at all times or free of errors. We may change, add or remove
        features. If we shut the service down, we will tell you at least 30 days
        before, so you can download your data.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using the service at any time by uninstalling the GitHub
        App and asking us to delete your data. We may suspend or close an
        account that breaks these terms. Where we can, we will tell you first
        and give you a chance to fix the problem.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The service is provided "as is". To the extent the law allows, we make
        no warranties, express or implied, including fitness for a particular
        purpose. Visual tests can miss changes; you remain responsible for what
        you ship.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or
        consequential losses, such as lost profits or lost data. Our total
        liability for any claim is limited to the amount you paid us in the 12
        months before the claim.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the laws of India. Any dispute goes to the
        courts of India.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        When we change these terms, we update the date at the top of this page.
        For material changes, we will tell you by email or on the site before
        they apply. Using the service after that means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Write to <SupportEmail />. See also the{" "}
        <Link to="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
