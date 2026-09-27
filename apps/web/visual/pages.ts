import { readdirSync } from "node:fs";
import { COMPARE_PAGE, COMPETITORS } from "../src/content/compare";
import { PAGES } from "../src/lib/pageMeta";

const docs = readdirSync(new URL("../src/content/docs", import.meta.url))
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.slice(0, -".mdx".length))
  .map((slug) => (slug === "quickstart" ? "/docs" : `/docs/${slug}`));

export const PUBLIC_PATHS = [
  ...Object.values(PAGES).map((page) => page.path),
  COMPARE_PAGE.path,
  ...COMPETITORS.map((competitor) => competitor.meta.path),
  ...docs,
];
