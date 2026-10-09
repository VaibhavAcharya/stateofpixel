import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  type AdsConsent,
  readAdsConsent,
  setAdsConsent,
  subscribeAdsConsent,
} from "../lib/ads";
import { buttonClass } from "./ui";

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
        className="pointer-events-auto flex w-full max-w-[420px] animate-enter flex-col gap-3 rounded-md bg-surface p-3 text-sm shadow-menu ring-1 ring-border"
      >
        <p>
          We use Google Ads cookies to see which ads bring sign-ups. See the{" "}
          <Link to="/privacy" className="text-link hover:underline">
            privacy policy
          </Link>
          .
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => onChoose("denied")}
          >
            Decline
          </button>
          <button
            type="button"
            className={buttonClass("secondary")}
            onClick={() => onChoose("granted")}
          >
            Allow
          </button>
        </div>
      </section>
    </div>
  );
}
