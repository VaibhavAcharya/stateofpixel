import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, "../../packages/backend", "CONVEX_URL");
  process.env.VITE_CONVEX_URL ??= backendEnv.CONVEX_URL;

  return {
    plugins: [
      netlify({ dev: { edgeFunctions: { enabled: false } } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
