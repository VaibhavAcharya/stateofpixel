import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("landing", async ({ page }) => {
  await page.goto("/");
  await snapshot(page, "landing");
});
