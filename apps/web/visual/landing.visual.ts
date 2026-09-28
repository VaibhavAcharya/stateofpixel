import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";
import { PUBLIC_PATHS } from "./pages";

for (const path of PUBLIC_PATHS) {
  const name = path === "/" ? "landing" : path.slice(1);
  test(name, async ({ page }) => {
    await page.goto(path);
    await snapshot(page, name);
  });
}
