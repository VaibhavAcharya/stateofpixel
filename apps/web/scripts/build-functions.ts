import { readdir } from "node:fs/promises";
import { build } from "esbuild";

const entries = (await readdir("functions")).filter((file) =>
  file.endsWith(".ts"),
);

await build({
  entryPoints: entries.map((file) => `functions/${file}`),
  outdir: "netlify/functions",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["pg-native", "bufferutil", "utf-8-validate"],
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
