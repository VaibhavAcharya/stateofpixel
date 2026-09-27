import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";
import { ogImagePath } from "../src/lib/pageMeta";
import { PUBLIC_PATHS } from "./pages";

for (const path of PUBLIC_PATHS) {
  const image = ogImagePath(path);
  const name = image.slice(1, -".png".length);
  test(name, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.goto(image);
    await snapshot(page, name, { fullPage: false });
  });
}
