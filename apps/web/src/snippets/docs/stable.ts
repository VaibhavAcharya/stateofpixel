import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("dashboard", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-01T10:00:00Z"));
  await page.goto("/dashboard");
  await page.getByRole("table").waitFor();
  await snapshot(page, "App/Dashboard");
});
