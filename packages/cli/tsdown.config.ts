import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/playwright.ts"],
  format: "esm",
  platform: "node",
  minify: false,
  sourcemap: true,
  dts: true,
});
