import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
} finally {
  await server.close();
}
