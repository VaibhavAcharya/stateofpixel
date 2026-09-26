import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";
import { LAB_OWNER } from "../src/lib/lab";

for (const [name, number] of [
  ["build", 1],
  ["build-storage-blocked", 2],
] as const) {
  test(name, async ({ page }) => {
    await page.goto(`/${LAB_OWNER}/web/builds/${number}`);
    await page.waitForURL(/\/snapshots\//);
    await page.waitForFunction(() =>
      [...document.images].every((image) => image.complete),
    );
    await snapshot(page, name);
  });
}

test("build-deleted", async ({ page }) => {
  await page.goto(`/${LAB_OWNER}/web/builds/3`);
  await page.getByText("This build was deleted.").waitFor();
  await snapshot(page, "build-deleted");
});
