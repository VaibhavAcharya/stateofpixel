import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createServer } from "vite";
import type { DOCS_NAV as DocsNav } from "../src/components/docs/DocsLayout";
import type * as Compare from "../src/content/compare";
import type { findDoc as FindDoc } from "../src/content/docs";
import type { PageMeta } from "../src/lib/pageMeta";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = "dist/client";

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown; src?: string };
};

function h(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node {
  return { type, props: { style, children } };
}

function image(src: string, style: Record<string, unknown>): Node {
  return { type: "img", props: { src, style } };
}

async function loadPages() {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    logLevel: "error",
  });
  try {
    const { PAGES, SITE_URL, ogImagePath } = (await server.ssrLoadModule(
      "/src/lib/pageMeta.ts",
    )) as typeof import("../src/lib/pageMeta");
    const { DOCS_NAV, docsPath } = (await server.ssrLoadModule(
      "/src/components/docs/DocsLayout.tsx",
    )) as { DOCS_NAV: typeof DocsNav; docsPath: (slug: string) => string };
    const { findDoc } = (await server.ssrLoadModule(
      "/src/content/docs/index.ts",
    )) as { findDoc: typeof FindDoc };
    const { COMPARE_PAGE, COMPETITORS } = (await server.ssrLoadModule(
      "/src/content/compare.ts",
    )) as typeof Compare;
    const docs = DOCS_NAV.flatMap((group) => group.pages).map(({ slug }) => {
      const meta = findDoc(slug)?.meta;
      if (meta === undefined) {
        throw new Error(`No docs page for ${slug}`);
      }
      return {
        path: docsPath(slug),
        title: meta.title,
        description: meta.description,
      };
    });
    return {
      pages: [
        ...Object.values(PAGES),
        COMPARE_PAGE,
        ...COMPETITORS.map((competitor) => ({
          ...competitor.meta,
          title: competitor.headline,
          logo: competitor.logo,
        })),
        ...docs,
      ],
      ogImagePath,
      siteUrl: SITE_URL,
    };
  } finally {
    await server.close();
  }
}

const require = createRequire(import.meta.url);

function font(file: string): Promise<Buffer> {
  return readFile(require.resolve(file));
}

async function dataUri(file: string, type: string): Promise<string> {
  return `data:${type};base64,${(await readFile(file)).toString("base64")}`;
}

type OgPage = PageMeta & { logo?: string };

function card(
  page: OgPage,
  wordmark: string,
  pixels: string,
  logo: string | null,
): Node {
  const home = page.path === "/";
  return h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 72,
      background: "#fafafa",
      fontFamily: "IBM Plex Sans",
      color: "#171717",
    },
    [
      image(pixels, {
        position: "absolute",
        right: 0,
        top: 0,
        height: HEIGHT,
        width: HEIGHT * 1.6,
        opacity: 0.5,
        maskImage:
          "radial-gradient(ellipse 45% 100% at 100% 50%, #000 10%, transparent 100%)",
      }),
      h("div", { display: "flex", alignItems: "center", gap: 24 }, [
        image(wordmark, { height: 44, width: 44 * 4.9345 }),
        logo !== null
          ? h("div", { display: "flex", alignItems: "center", gap: 24 }, [
              h(
                "div",
                { fontFamily: "Lilex", fontSize: 26, color: "#666666" },
                "vs",
              ),
              image(logo, { height: 52, width: 52, borderRadius: 12 }),
            ])
          : home
            ? null
            : h(
                "div",
                { fontFamily: "Lilex", fontSize: 26, color: "#666666" },
                page.path,
              ),
      ]),
      h("div", { display: "flex", flexDirection: "column", gap: 24 }, [
        h(
          "div",
          {
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.045em",
            textWrap: "balance",
            maxWidth: 900,
          },
          page.title,
        ),
        home
          ? null
          : h(
              "div",
              {
                fontSize: 30,
                lineHeight: 1.4,
                color: "#666666",
                maxWidth: 720,
                textWrap: "balance",
              },
              page.description,
            ),
      ]),
    ],
  );
}

const [
  { pages, ogImagePath, siteUrl },
  regular,
  semibold,
  mono,
  wordmark,
  pixels,
] = await Promise.all([
  loadPages(),
  font("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff"),
  font("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff"),
  font("@fontsource/lilex/files/lilex-latin-400-normal.woff"),
  dataUri("public/brand/stateofpixel-wordmark.svg", "image/svg+xml"),
  dataUri("public/pricing-pixels.png", "image/png"),
]);

for (const page of pages as OgPage[]) {
  const logo =
    page.logo === undefined
      ? null
      : await dataUri(join("public", page.logo), "image/png");
  const svg = await satori(card(page, wordmark, pixels, logo) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "IBM Plex Sans", data: regular, weight: 400 },
      { name: "IBM Plex Sans", data: semibold, weight: 600 },
      { name: "Lilex", data: mono, weight: 400 },
    ],
  });
  const file = join(OUT_DIR, ogImagePath(page.path));
  await mkdir(dirname(file), { recursive: true });
  const png = new Resvg(
    svg.replace(`<image `, `<image image-rendering="optimizeSpeed" `),
  )
    .render()
    .asPng();
  await writeFile(file, png);
}
console.log(`Wrote ${pages.length} Open Graph images to ${OUT_DIR}/og`);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((page) => `  <url><loc>${siteUrl}${page.path}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeFile(join(OUT_DIR, "sitemap.xml"), sitemap);
console.log(`Wrote ${pages.length} URLs to ${OUT_DIR}/sitemap.xml`);
