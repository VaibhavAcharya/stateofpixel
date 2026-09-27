import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";
import { ogImagePath } from "../src/lib/pageMeta";

test("og images", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The cards are 1200x630");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const paths = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map(
    ([, loc]) => new URL(loc ?? "").pathname,
  );
  await page.setViewportSize({ width: 1200, height: 630 });
  for (const path of paths) {
    const image = ogImagePath(path);
    await page.goto(image);
    await snapshot(page, image.slice(1, -".png".length), { fullPage: false });
  }
});
