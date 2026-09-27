import mdx from "@mdx-js/rollup";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { highlightSnippets, remarkCodeBlocks } from "./highlightSnippets";

function ogImages(): Plugin {
  return {
    name: "og-images",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        if (!path.startsWith("/og/") && path !== "/sitemap.xml") {
          return next();
        }
        try {
          const { loadOgPages, renderOgImage, sitemap } =
            (await server.ssrLoadModule(
              "/scripts/ogImage.ts",
            )) as typeof import("./scripts/ogImage");
          const { pages, ogImagePath, siteUrl } = await loadOgPages(server);
          if (path === "/sitemap.xml") {
            res.setHeader("Content-Type", "application/xml");
            res.end(sitemap(pages, siteUrl));
            return;
          }
          const page = pages.find((page) => ogImagePath(page.path) === path);
          if (page === undefined) {
            return next();
          }
          res.setHeader("Content-Type", "image/png");
          res.end(await renderOgImage(page));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, "../../packages/backend", "CONVEX_URL");
  process.env.VITE_CONVEX_URL ??= backendEnv.CONVEX_URL;

  return {
    plugins: [
      ogImages(),
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
