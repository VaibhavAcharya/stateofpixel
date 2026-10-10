import type { User } from "@netlify/identity";
import { IS_PUBLIC_PATH_SCRIPT } from "./analytics";

const GOOGLE_ADS_ID = "AW-18504663956";
const SIGN_UP_CONVERSION = `${GOOGLE_ADS_ID}/fP0YCPXr05cdEJSH2_dE`;
const CONSENT_KEY = "adsConsent";
const NEW_USER_MS = 10 * 60 * 1000;
const CONVERSION_TIMEOUT_MS = 1000;

export type AdsConsent = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const GOOGLE_TAG_SCRIPT = `if (location.hostname === "stateofpixel.com") {
  ${IS_PUBLIC_PATH_SCRIPT}
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  let consent = "denied";
  try { if (localStorage.getItem("${CONSENT_KEY}") === "granted") consent = "granted"; } catch {}
  gtag("consent", "default", {
    ad_storage: consent,
    ad_user_data: consent,
    ad_personalization: consent,
    analytics_storage: "denied",
  });
  gtag("js", new Date());
  const publicPage = isPublic(location.pathname);
  gtag("set", {
    page_location: publicPage
      ? location.origin + location.pathname + location.search
      : location.origin + "/",
    page_referrer: "",
  });
  gtag("config", "${GOOGLE_ADS_ID}", { send_page_view: publicPage });
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}";
  document.head.appendChild(script);
}`;

const listeners = new Set<() => void>();

export function subscribeAdsConsent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readAdsConsent(): AdsConsent | null {
  try {
    const consent = localStorage.getItem(CONSENT_KEY);
    return consent === "granted" || consent === "denied" ? consent : null;
  } catch {
    return null;
  }
}

export function setAdsConsent(consent: AdsConsent | null) {
  try {
    if (consent === null) {
      localStorage.removeItem(CONSENT_KEY);
    } else {
      localStorage.setItem(CONSENT_KEY, consent);
    }
  } catch {}
  const state = consent ?? "denied";
  window.gtag?.("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
  for (const listener of listeners) {
    listener();
  }
}

export function reportSignUp(user: User | null): Promise<void> {
  const gtag = window.gtag;
  const createdAt = Date.parse(user?.createdAt ?? "");
  if (gtag === undefined || !(Date.now() - createdAt < NEW_USER_MS)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, CONVERSION_TIMEOUT_MS);
    gtag("event", "conversion", {
      send_to: SIGN_UP_CONVERSION,
      event_callback: resolve,
    });
  });
}
