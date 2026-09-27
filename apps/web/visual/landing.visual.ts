import { readdirSync } from "node:fs";
import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";
import { COMPARE_PAGE, COMPETITORS } from "../src/content/compare";
import { PAGES } from "../src/lib/pageMeta";

const docs = readdirSync(new URL("../src/content/docs", import.meta.url))
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.slice(0, -".mdx".length))
  .map((slug) => (slug === "quickstart" ? "/docs" : `/docs/${slug}`));

for (const path of [
  ...Object.values(PAGES).map((page) => page.path),
  COMPARE_PAGE.path,
  ...COMPETITORS.map((competitor) => competitor.meta.path),
  ...docs,
]) {
  const name = path === "/" ? "landing" : path.slice(1);
  test(name, async ({ page }) => {
    await page.goto(path);
    await snapshot(page, name);
  });
}
