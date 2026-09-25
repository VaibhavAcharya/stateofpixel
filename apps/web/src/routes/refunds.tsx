import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, SupportEmail } from "../components/LegalPage";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund policy - stateofpixel" },
      {
        name: "description",
        content: "How cancellation and refunds work for stateofpixel.",
      },
    ],
  }),
  component: Refunds,
});

function Refunds() {
  return (
    <LegalPage title="Refund policy" updated="September 25, 2026">
      <p>
        The free plan has no charges. Paid plans, when offered, are
        subscriptions billed in advance, monthly or yearly, as described in the{" "}
        <Link to="/terms">terms</Link>.
      </p>

      <h2>Cancel anytime</h2>
      <p>
        You can cancel a paid plan at any time by writing to <SupportEmail />.
        After you cancel, your plan does not renew. It stays active until the
        end of the period you paid for, then your account moves to the free
        plan.
      </p>

      <h2>No refunds</h2>
      <p>
        Payments for a period that has started are not refunded, including for a
        partly used month or year.
      </p>

      <h2>Billing errors</h2>
      <p>
        If we charged you by mistake or charged you twice, we refund that charge
        in full to the original payment method. Write to <SupportEmail /> with
        the date and amount of the charge.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about a charge go to <SupportEmail />.
      </p>
    </LegalPage>
  );
}
