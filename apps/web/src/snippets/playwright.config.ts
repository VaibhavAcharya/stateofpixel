import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [["list"], ["stateofpixel/playwright"]],
});
