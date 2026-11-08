import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "uiofcraft";
import {
  type AdsConsent,
  readAdsConsent,
  setAdsConsent,
  subscribeAdsConsent,
} from "../lib/ads";

export function AdsConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.gtag === undefined) {
      return;
    }
    const update = () => setOpen(readAdsConsent() === null);
    update();
    return subscribeAdsConsent(update);
  }, []);

  if (!open) {
    return null;
  }
  return (
    <AdsConsentPrompt
      onChoose={(consent) => {
        setAdsConsent(consent);
        setOpen(false);
      }}
    />
  );
}

export function AdsConsentPrompt({
  onChoose,
}: {
  onChoose: (consent: AdsConsent) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <section
        aria-label="Cookies"
        className="pointer-events-auto relative flex w-full max-w-[420px] animate-enter flex-col gap-3 rounded-lg border bg-popover not-dark:bg-clip-padding p-3.5 text-sm text-popover-foreground shadow-lg/5"
      >
        <p>
          We use cookies to measure our marketing.{" "}
          <Link to="/privacy" className="text-link hover:underline">
            Privacy policy
          </Link>
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onChoose("denied")}>
            Decline
          </Button>
          <Button variant="outline" onClick={() => onChoose("granted")}>
            Accept
          </Button>
        </div>
      </section>
    </div>
  );
}
