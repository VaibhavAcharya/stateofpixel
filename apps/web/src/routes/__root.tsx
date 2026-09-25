import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convex: ConvexReactClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "stateofpixel" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [{ children: THEME_SCRIPT }],
  }),
  headers: () => ({
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control":
      "public, durable, s-maxage=86400, stale-while-revalidate=604800",
  }),
  component: RootComponent,
});

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
        <Scripts />
      </body>
    </html>
  );
}
