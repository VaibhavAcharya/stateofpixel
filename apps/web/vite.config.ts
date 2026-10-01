import mdx from "@mdx-js/rollup";
import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig, type Plugin } from "vite";
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
            res.end(sitemap(pages, siteUrl, () => undefined));
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

function llmsFiles(): Plugin {
  return {
    name: "llms-files",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0] ?? "";
        if (!path.endsWith(".md") && !path.startsWith("/llms")) {
          return next();
        }
        try {
          const { buildLlmsFiles, loadLlmsModules, contentType } =
            (await server.ssrLoadModule(
              "/scripts/llms.ts",
            )) as typeof import("./scripts/llms");
          const origin = `http://${req.headers.host}`;
          const files = await buildLlmsFiles(
            await loadLlmsModules(server),
            async (page) => (await fetch(`${origin}${page}`)).text(),
          );
          const content = files.get(path);
          if (content === undefined) {
            return next();
          }
          res.setHeader("Content-Type", contentType(path));
          res.end(content);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

const buildingOnNetlify =
  process.env.NETLIFY === "true" || process.env.NETLIFY_LOCAL === "true";

export default defineConfig(({ command }) => ({
  plugins: [
    ogImages(),
    llmsFiles(),
    (command === "serve" || buildingOnNetlify) &&
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
}));
