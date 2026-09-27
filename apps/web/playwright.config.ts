import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "visual",
  testMatch: "*.visual.ts",
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["stateofpixel/playwright", { buildName: "web" }]],
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: { args: ["--disable-partial-raster"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 800 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
