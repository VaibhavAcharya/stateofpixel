import { createReadStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { InvalidArgumentError } from "commander";
import { mapConcurrent } from "../map-concurrent";
import { metadataFile } from "../upload";
import { type UploadCommandOptions, uploadCommand } from "./upload";

const CAPTURE_CONCURRENCY = 4;
const STORY_TIMEOUT_MS = 15_000;
const VIEWPORT_HEIGHT = 720;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export type StorybookCommandOptions = UploadCommandOptions & {
  viewports: number[];
  include?: string;
  exclude?: string;
  waitForSelector: string;
  delay: number;
};

export type Story = {
  id: string;
  title: string;
  name: string;
  importPath?: string;
};

export async function storybookCommand(
  staticDir: string,
  options: StorybookCommandOptions,
): Promise<void> {
  const stories = filterStories(
    await readStories(staticDir),
    options.include,
    options.exclude,
  );
  if (stories.length === 0) {
    throw new Error(`No stories found in ${staticDir}/index.json.`);
  }
  const outDir = await mkdtemp(path.join(tmpdir(), "stateofpixel-storybook-"));
  try {
    const failed = await captureStories(staticDir, outDir, stories, options);
    if (failed.length > 0) {
      throw new Error(`Stories that did not render: ${failed.join(", ")}`);
    }
    await uploadCommand(outDir, options);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

async function readStories(staticDir: string): Promise<Story[]> {
  const text = await readFile(path.join(staticDir, "index.json"), "utf8").catch(
    () => {
      throw new Error(
        `No index.json in ${staticDir}. Run storybook build first, Storybook 7 or newer.`,
      );
    },
  );
  const index = JSON.parse(text) as {
    entries?: Record<string, Story & { type?: string }>;
  };
  return Object.values(index.entries ?? {})
    .filter((entry) => entry.type === "story")
    .map(({ id, title, name, importPath }) => ({
      id,
      title,
      name,
      importPath,
    }));
}

export function filterStories(
  stories: Story[],
  include: string | undefined,
  exclude: string | undefined,
): Story[] {
  const includes = include === undefined ? null : globToRegExp(include);
  const excludes = exclude === undefined ? null : globToRegExp(exclude);
  return stories.filter((story) => {
    const name = `${story.title}/${story.name}`;
    return (
      (includes === null || includes.test(name)) &&
      (excludes === null || !excludes.test(name))
    );
  });
}

function globToRegExp(glob: string): RegExp {
  const source = glob
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((text) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${source}$`);
}

export function storySnapshotName(story: Story, width: number): string {
  return `${story.title}/${story.name} [chromium ${width}]`;
}

async function captureStories(
  staticDir: string,
  outDir: string,
  stories: Story[],
  options: StorybookCommandOptions,
): Promise<string[]> {
  const { chromium } = await import("playwright").catch(() => {
    throw new Error(
      "stateofpixel storybook needs Playwright. Run npm install -D playwright, then npx playwright install chromium.",
    );
  });
  const server = await serveStatic(staticDir);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const browser = await chromium.launch();
  const failed: string[] = [];
  try {
    for (const width of options.viewports) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      await mapConcurrent(stories, CAPTURE_CONCURRENCY, async (story) => {
        const name = storySnapshotName(story, width);
        const file = path.join(outDir, `${name}.png`);
        const page = await context.newPage();
        try {
          await page.goto(
            `${baseUrl}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
            { timeout: STORY_TIMEOUT_MS },
          );
          await page.waitForSelector(options.waitForSelector, {
            timeout: STORY_TIMEOUT_MS,
          });
          await page.evaluate("document.fonts.ready");
          if (options.delay > 0) {
            await page.waitForTimeout(options.delay);
          }
          await mkdir(path.dirname(file), { recursive: true });
          await page.screenshot({
            path: file,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
          });
          await writeFile(
            metadataFile(file),
            JSON.stringify({
              browser: "chromium",
              viewport: width,
              storyId: story.id,
              importPath: story.importPath,
            }),
          );
        } catch {
          failed.push(name);
        } finally {
          await page.close();
        }
      });
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(
    `stateofpixel  captured ${stories.length * options.viewports.length - failed.length} screenshots from ${stories.length} stories`,
  );
  return failed;
}

async function serveStatic(root: string): Promise<Server> {
  const base = path.resolve(root);
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const file = path.join(
      base,
      pathname.endsWith("/") ? `${pathname}index.html` : pathname,
    );
    if (!file.startsWith(`${base}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    stat(file).then(
      (stats) => {
        if (!stats.isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Content-Type":
            CONTENT_TYPES[path.extname(file).toLowerCase()] ??
            "application/octet-stream",
        });
        createReadStream(file).pipe(response);
      },
      () => response.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

export function parseViewports(value: string): number[] {
  const widths = value.split(",").map((width) => Number(width.trim()));
  if (
    widths.length === 0 ||
    widths.some((width) => !Number.isInteger(width) || width < 1)
  ) {
    throw new InvalidArgumentError("Must look like 375,1280.");
  }
  return widths;
}

export function parseDelay(value: string): number {
  const delay = Number(value);
  if (!Number.isInteger(delay) || delay < 0) {
    throw new InvalidArgumentError("Must be a whole number of milliseconds.");
  }
  return delay;
}
