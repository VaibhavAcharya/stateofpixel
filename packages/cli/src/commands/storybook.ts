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
import type { Browser, BrowserContext } from "playwright";
import { mapConcurrent } from "../map-concurrent";
import { ENV } from "../reference";
import { metadataFile, type Shard } from "../upload";
import { parseShard, type UploadCommandOptions, uploadCommand } from "./upload";

const CAPTURE_CONCURRENCY = 4;
const STORY_TIMEOUT_MS = 15_000;
const PARAMETERS_TIMEOUT_MS = 60_000;
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
  tag?: string;
  globals?: string;
  chromatic: boolean;
  waitForSelector: string;
  delay: number;
  deviceScaleFactor: number;
};

export type ChromaticParameters = {
  disable?: boolean;
  disableSnapshot?: boolean;
  delay?: number;
  viewports?: number[];
  modes?: Record<string, Record<string, unknown>>;
};

export type Story = {
  id: string;
  title: string;
  name: string;
  importPath?: string;
  tags?: string[];
  chromatic?: ChromaticParameters;
  namedViewports?: Record<string, number>;
};

export type Capture = {
  story: Story;
  name: string;
  width: number;
  globals?: string;
  delay: number;
};

type Storybook = { browser: Browser; baseUrl: string };

type PreviewStore = {
  cacheAllCSFFiles(): Promise<void>;
  extract(): Record<
    string,
    { id: string; tags?: string[]; parameters?: Record<string, unknown> }
  >;
};

type StorybookWindow = {
  __STORYBOOK_PREVIEW__?: {
    storyStoreValue?: PreviewStore;
    storyStore?: PreviewStore;
  };
};

export async function storybookCommand(
  staticDir: string,
  options: StorybookCommandOptions,
): Promise<void> {
  const shard = options.shard ?? parseShard(process.env[ENV.shard] ?? "1/1");
  if (shard.total === null) {
    throw new Error(
      "storybook does not split stories with --shard auto. Use --shard i/n, like --shard 2/4.",
    );
  }
  const indexedStories = await readStories(staticDir);
  const outDir = await mkdtemp(path.join(tmpdir(), "stateofpixel-storybook-"));
  try {
    const failed = await withStorybook(staticDir, async (storybook) => {
      const stories = shardStories(
        filterStories(
          options.chromatic
            ? (await readChromaticParameters(storybook, indexedStories)).filter(
                isCapturedByChromatic,
              )
            : indexedStories,
          options.include,
          options.exclude,
          options.tag,
        ),
        shard,
      );
      if (stories.length === 0) {
        throw new Error(`No stories found in ${staticDir}/index.json.`);
      }
      const captures = planCaptures(stories, options);
      const notRendered = await captureStories(
        storybook,
        outDir,
        captures,
        options.waitForSelector,
        options.deviceScaleFactor,
      );
      console.log(
        `stateofpixel  captured ${captures.length - notRendered.length} screenshots from ${stories.length} stories`,
      );
      return notRendered;
    });
    if (failed.length > 0) {
      throw new Error(`Stories that did not render:\n  ${failed.join("\n  ")}`);
    }
    await uploadCommand(outDir, { ...options, shard });
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
    .map(({ id, title, name, importPath, tags }) => ({
      id,
      title,
      name,
      importPath,
      tags,
    }));
}

export function filterStories(
  stories: Story[],
  include: string | undefined,
  exclude: string | undefined,
  tag?: string,
): Story[] {
  const includes = include === undefined ? null : globToRegExp(include);
  const excludes = exclude === undefined ? null : globToRegExp(exclude);
  return stories.filter((story) => {
    const name = `${story.title}/${story.name}`;
    return (
      (includes === null || includes.test(name)) &&
      (excludes === null || !excludes.test(name)) &&
      (tag === undefined || (story.tags ?? []).includes(tag))
    );
  });
}

export function shardStories(stories: Story[], shard: Shard): Story[] {
  const { index, total } = shard;
  if (index === null || total === null) {
    return stories;
  }
  return stories.filter((_, position) => position % total === index - 1);
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

export function storyUrl(
  baseUrl: string,
  story: Story,
  globals: string | undefined,
): string {
  const url = `${baseUrl}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
  return globals === undefined
    ? url
    : `${url}&globals=${encodeURIComponent(globals)}`;
}

export function isCapturedByChromatic(story: Story): boolean {
  return (
    story.chromatic?.disable !== true &&
    story.chromatic?.disableSnapshot !== true
  );
}

export function planCaptures(
  stories: Story[],
  options: Pick<
    StorybookCommandOptions,
    "viewports" | "globals" | "chromatic" | "delay"
  >,
): Capture[] {
  const defaultWidth = options.viewports[0] as number;
  return stories.flatMap((story) => {
    const chromatic = options.chromatic ? story.chromatic : undefined;
    const delay = chromatic?.delay ?? options.delay;
    const modes = Object.entries(chromatic?.modes ?? {}).filter(
      ([, mode]) => mode.disable !== true,
    );
    if (modes.length > 0) {
      return modes.map(([modeName, { viewport, ...modeGlobals }]) => {
        const label = `${story.title}/${story.name}: mode "${modeName}"`;
        return {
          story,
          name: `${story.title}/${story.name} [chromium ${modeName}]`,
          width:
            viewport === undefined
              ? defaultWidth
              : modeWidth(label, story, viewport),
          globals: mergeGlobals(label, options.globals, modeGlobals),
          delay,
        };
      });
    }
    return (chromatic?.viewports ?? options.viewports).map((width) => ({
      story,
      name: storySnapshotName(story, width),
      width,
      globals: options.globals,
      delay,
    }));
  });
}

function modeWidth(label: string, story: Story, viewport: unknown): number {
  const width =
    typeof viewport === "number"
      ? viewport
      : typeof viewport === "string"
        ? story.namedViewports?.[viewport]
        : undefined;
  if (width === undefined || !Number.isInteger(width) || width < 1) {
    throw new Error(
      `${label} has viewport ${JSON.stringify(viewport)}, which is not a width in pixels.`,
    );
  }
  return width;
}

function mergeGlobals(
  label: string,
  flagGlobals: string | undefined,
  modeGlobals: Record<string, unknown>,
): string | undefined {
  const globals = new Map(
    (flagGlobals?.split(";") ?? []).map((pair) => {
      const [key = "", value = ""] = pair.split(":");
      return [key, value];
    }),
  );
  for (const [key, value] of Object.entries(modeGlobals)) {
    if (key === "disable") {
      continue;
    }
    if (typeof value === "boolean") {
      globals.set(key, `!${value}`);
    } else if (typeof value === "string" || typeof value === "number") {
      globals.set(key, String(value));
    } else {
      throw new Error(
        `${label} sets ${key} to a value the CLI cannot pass to Storybook.`,
      );
    }
  }
  return globals.size === 0
    ? undefined
    : [...globals].map(([key, value]) => `${key}:${value}`).join(";");
}

async function withStorybook<T>(
  staticDir: string,
  run: (storybook: Storybook) => Promise<T>,
): Promise<T> {
  const { chromium } = await import("playwright").catch(() => {
    throw new Error(
      "stateofpixel storybook needs Playwright. Run npm install -D playwright, then npx playwright install chromium.",
    );
  });
  const server = await serveStatic(staticDir);
  const browser = await chromium.launch();
  try {
    return await run({
      browser,
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
  } finally {
    await browser.close();
    server.close();
  }
}

async function readChromaticParameters(
  storybook: Storybook,
  stories: Story[],
): Promise<Story[]> {
  const page = await storybook.browser.newPage();
  try {
    await page.goto(`${storybook.baseUrl}/iframe.html`, {
      timeout: PARAMETERS_TIMEOUT_MS,
    });
    await page.waitForFunction(
      () => {
        const preview = (globalThis as StorybookWindow).__STORYBOOK_PREVIEW__;
        return preview?.storyStoreValue ?? preview?.storyStore;
      },
      undefined,
      { timeout: PARAMETERS_TIMEOUT_MS },
    );
    const text = await page.evaluate(async () => {
      const preview = (globalThis as StorybookWindow).__STORYBOOK_PREVIEW__;
      const store = (preview?.storyStoreValue ??
        preview?.storyStore) as PreviewStore;
      await store.cacheAllCSFFiles();
      return JSON.stringify(
        Object.values(store.extract()).map(({ id, tags, parameters }) => {
          const viewport = parameters?.viewport as
            | {
                viewports?: Record<string, { styles?: { width?: string } }>;
                options?: Record<string, { styles?: { width?: string } }>;
              }
            | undefined;
          const namedViewports: Record<string, number> = {};
          for (const [name, value] of Object.entries(
            viewport?.viewports ?? viewport?.options ?? {},
          )) {
            const width = /^(\d+)px$/.exec(value?.styles?.width ?? "")?.[1];
            if (width !== undefined) {
              namedViewports[name] = Number(width);
            }
          }
          return { id, tags, chromatic: parameters?.chromatic, namedViewports };
        }),
      );
    });
    const parameters = new Map(
      (JSON.parse(text) as Story[]).map((entry) => [entry.id, entry]),
    );
    return stories.map((story) => {
      const entry = parameters.get(story.id);
      return entry === undefined
        ? story
        : {
            ...story,
            tags: entry.tags,
            chromatic: entry.chromatic,
            namedViewports: entry.namedViewports,
          };
    });
  } catch (error) {
    throw new Error(
      `Could not read story parameters from ${storybook.baseUrl}/iframe.html: ${error instanceof Error ? error.message : error}`,
    );
  } finally {
    await page.close();
  }
}

async function captureStories(
  storybook: Storybook,
  outDir: string,
  captures: Capture[],
  waitForSelector: string,
  deviceScaleFactor: number,
): Promise<string[]> {
  const failed: string[] = [];
  await mapConcurrent(
    captures,
    CAPTURE_CONCURRENCY,
    async ({ story, name, width, globals, delay }) => {
      const file = path.join(outDir, `${name}.png`);
      let context: BrowserContext | undefined;
      try {
        context = await storybook.browser.newContext({
          viewport: { width, height: VIEWPORT_HEIGHT },
          deviceScaleFactor,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.goto(storyUrl(storybook.baseUrl, story, globals), {
          timeout: STORY_TIMEOUT_MS,
        });
        await page.waitForSelector(waitForSelector, {
          timeout: STORY_TIMEOUT_MS,
        });
        await page.evaluate("document.fonts.ready");
        if (delay > 0) {
          await page.waitForTimeout(delay);
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
      } catch (error) {
        const reason = (
          error instanceof Error ? error.message : String(error)
        ).split("\n")[0];
        failed.push(`${name}: ${reason}`);
      } finally {
        await context?.close();
      }
    },
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
          "Cache-Control": "max-age=3600",
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

export function parseGlobals(value: string): string {
  if (!/^[\w-]+:[^;:]+(;[\w-]+:[^;:]+)*$/.test(value)) {
    throw new InvalidArgumentError("Must look like brand:new;theme:dark.");
  }
  return value;
}

export function parseDelay(value: string): number {
  const delay = Number(value);
  if (!Number.isInteger(delay) || delay < 0) {
    throw new InvalidArgumentError("Must be a whole number of milliseconds.");
  }
  return delay;
}

export function parseDeviceScaleFactor(value: string): number {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new InvalidArgumentError("Must be a number above 0, like 2.");
  }
  return scale;
}
