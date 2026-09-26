import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("pricing", async ({ page }) => {
  await page.goto("/pricing");
  await snapshot(page, "Marketing/Pricing");
  await snapshot(page, "Marketing/Pricing fold", { fullPage: false });
});
