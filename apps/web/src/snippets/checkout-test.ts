import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("empty cart", async ({ page }) => {
  await page.goto("/cart");
  await snapshot(page, "Checkout/Empty cart");
});
