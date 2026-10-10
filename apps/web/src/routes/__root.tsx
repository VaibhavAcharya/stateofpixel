import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AdsConsentBanner } from "../components/AdsConsentBanner";
import { GOOGLE_TAG_SCRIPT } from "../lib/ads";
import { UMAMI_BEFORE_SEND_SCRIPT } from "../lib/analytics";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "stateofpixel" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [
      { children: THEME_SCRIPT },
      ...(import.meta.env.STATEOFPIXEL_SELF_HOSTED
        ? []
        : [...UMAMI_SCRIPTS, { children: GOOGLE_TAG_SCRIPT }]),
    ],
  }),
  headers: () => ({
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control":
      "public, durable, s-maxage=86400, stale-while-revalidate=604800",
  }),
  component: RootComponent,
});

const UMAMI_SCRIPTS = [
  { children: UMAMI_BEFORE_SEND_SCRIPT },
  {
    src: "https://cloud.umami.is/script.js",
    defer: true,
    "data-website-id": "82c68e9d-e447-43cc-9f60-87ef5c9b1f7f",
    "data-domains": "stateofpixel.com",
    "data-before-send": "umamiBeforeSend",
    "data-do-not-track": "true",
    "data-performance": "true",
  },
];

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

const THEME_SCRIPT = `(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let theme = "system";
    try { theme = localStorage.getItem("theme") || "system"; } catch {}
    const dark = theme === "dark" || (theme === "system" && media.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  apply();
  media.addEventListener("change", apply);
})();`;

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <AdsConsentBanner />
        <Scripts />
      </body>
    </html>
  );
}
