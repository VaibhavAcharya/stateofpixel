import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const pagesDir = path.resolve("pages");
const outDir = path.resolve(process.argv[2] ?? "screenshots");
const viewport = { width: 800, height: 400 };

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const pages = (await readdir(pagesDir))
  .filter((file) => file.endsWith(".html"))
  .sort();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

for (const file of pages) {
  await page.goto(pathToFileURL(path.join(pagesDir, file)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: path.join(outDir, `${path.basename(file, ".html")}.png`),
    animations: "disabled",
    caret: "hide",
  });
}

await browser.close();
console.log(
  `captured ${pages.length} pages into ${path.relative(process.cwd(), outDir)}`,
);
