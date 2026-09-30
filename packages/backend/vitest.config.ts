import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
