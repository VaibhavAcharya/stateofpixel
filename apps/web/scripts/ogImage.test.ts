import { describe, expect, it } from "vitest";
import { pageSources, sitemap } from "./ogImage";

const SITE_URL = "https://stateofpixel.com";

describe("pageSources", () => {
  it("maps docs pages to their MDX file", () => {
    expect(pageSources("/docs")).toEqual(["src/content/docs/quickstart.mdx"]);
    expect(pageSources("/docs/cli")).toEqual(["src/content/docs/cli.mdx"]);
  });
});

describe("sitemap", () => {
  it("adds lastmod only when a date is known", () => {
    const pages = [
      { path: "/", title: "Home", description: "" },
      { path: "/brand", title: "Brand", description: "" },
    ];
    expect(
      sitemap(pages, SITE_URL, (path) =>
        path === "/" ? "2026-09-28T12:00:00+05:30" : undefined,
      ),
    ).toContain(
      `<url><loc>${SITE_URL}</loc><lastmod>2026-09-28T12:00:00+05:30</lastmod></url>\n  <url><loc>${SITE_URL}/brand</loc></url>`,
    );
  });
});
