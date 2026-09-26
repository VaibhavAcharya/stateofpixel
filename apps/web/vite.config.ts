import mdx from "@mdx-js/rollup";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig, loadEnv } from "vite";
import { highlightSnippets, remarkCodeBlocks } from "./highlightSnippets";

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, "../../packages/backend", "CONVEX_URL");
  process.env.VITE_CONVEX_URL ??= backendEnv.CONVEX_URL;

  return {
    plugins: [
      netlify({ dev: { edgeFunctions: { enabled: false } } }),
      tailwindcss(),
      highlightSnippets(),
      {
        enforce: "pre",
        ...mdx({
          remarkPlugins: [remarkGfm, remarkCodeBlocks],
        }),
      },
      tanstackStart(),
      viteReact(),
    ],
  };
});
