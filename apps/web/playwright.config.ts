import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "visual",
  testMatch: "*.visual.ts",
  forbidOnly: !!process.env.CI,
  workers: 2,
  fullyParallel: true,
  reporter: [["list"], ["stateofpixel/playwright", { buildName: "web" }]],
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: { args: ["--disable-partial-raster"] },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2 },
    },
    {
      name: "mobile",
      testIgnore: "og.visual.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 800 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: "pnpm dev:vite",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
