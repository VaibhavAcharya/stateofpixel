export const SITE_URL = "https://stateofpixel.com";

export type PageMeta = { path: string; title: string; description: string };

export const PAGES = {
  home: {
    path: "/",
    title: "Catch UI regressions before they merge.",
    description:
      "Visual regression testing for GitHub pull requests. Your CI takes the screenshots, a person approves each change. Free up to 10 GB.",
  },
  brand: {
    path: "/brand",
    title: "Brand",
    description: "The stateofpixel logo, colors and type, with downloads.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy policy",
    description: "What data stateofpixel collects, why, and how long it stays.",
  },
  terms: {
    path: "/terms",
    title: "Terms and conditions",
    description: "The terms for using stateofpixel.",
  },
  refunds: {
    path: "/refunds",
    title: "Refund policy",
    description: "How cancellation and refunds work for stateofpixel.",
  },
} satisfies Record<string, PageMeta>;

export function ogImagePath(path: string): string {
  return path === "/" ? "/og/index.png" : `/og${path}.png`;
}

export function pageMeta(page: PageMeta) {
  return [
    { name: "description", content: page.description },
    { property: "og:site_name", content: "stateofpixel" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: `${SITE_URL}${page.path}` },
    { property: "og:image", content: `${SITE_URL}${ogImagePath(page.path)}` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: page.title },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export function pageLinks(page: PageMeta) {
  return [{ rel: "canonical", href: `${SITE_URL}${page.path}` }];
}
