import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const OUT_DIR = "dist/client";

const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
});
try {
  const { loadOgPages, renderOgImage, sitemap } = (await server.ssrLoadModule(
    "/scripts/ogImage.ts",
  )) as typeof import("./ogImage");
  const { pages, ogImagePath, siteUrl } = await loadOgPages(server);
  for (const page of pages) {
    const file = join(OUT_DIR, ogImagePath(page.path));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await renderOgImage(page));
  }
  console.log(`Wrote ${pages.length} Open Graph images to ${OUT_DIR}/og`);

  await writeFile(join(OUT_DIR, "sitemap.xml"), sitemap(pages, siteUrl));
  console.log(`Wrote ${pages.length} URLs to ${OUT_DIR}/sitemap.xml`);

  const { buildLlmsFiles, loadLlmsModules } = (await server.ssrLoadModule(
    "/scripts/llms.ts",
  )) as typeof import("./llms");
  const { default: app } = (await import(
    pathToFileURL(join(process.cwd(), "dist/server/server.js")).href
  )) as { default: { fetch: (request: Request) => Promise<Response> } };
  const files = await buildLlmsFiles(
    await loadLlmsModules(server),
    async (path) => {
      const response = await app.fetch(new Request(`${siteUrl}${path}`));
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      return response.text();
    },
  );
  for (const [path, content] of files) {
    const file = join(OUT_DIR, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  console.log(
    `Wrote llms.txt and ${files.size - 2} Markdown pages to ${OUT_DIR}`,
  );
} finally {
  await server.close();
}
