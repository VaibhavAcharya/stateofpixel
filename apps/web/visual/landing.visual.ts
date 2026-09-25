import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("landing", async ({ page }) => {
  await page.goto("/");
  await snapshot(page, "landing");
});

for (const path of ["brand", "privacy", "terms", "refunds"]) {
  test(path, async ({ page }) => {
    await page.goto(`/${path}`);
    await snapshot(page, path);
  });
}
