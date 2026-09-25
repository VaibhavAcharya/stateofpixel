import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Page, test } from "@playwright/test";
import type {
  FullConfig,
  FullResult,
  Reporter,
} from "@playwright/test/reporter";
import { uploadCommand } from "./commands/upload";
import { metadataFile, type Shard } from "./upload";

const DEFAULT_DIR = "stateofpixel-screenshots";

function snapshotDir(): string {
  return path.resolve(process.env.STATEOFPIXEL_DIR ?? DEFAULT_DIR);
}

export async function snapshot(
  page: Page,
  name: string,
  { fullPage = true }: { fullPage?: boolean } = {},
): Promise<void> {
  if (name.split("/").some((part) => part === "" || part === "..")) {
    throw new Error(`Invalid snapshot name "${name}".`);
  }
  const info = test.info();
  const browser =
    page.context().browser()?.browserType().name() ?? info.project.name;
  const width = page.viewportSize()?.width;
  const suffix = width === undefined ? browser : `${browser} ${width}`;
  const file = path.join(snapshotDir(), `${name} [${suffix}].png`);
  await mkdir(path.dirname(file), { recursive: true });
  await page.evaluate("document.fonts.ready");
  await page.screenshot({
    path: file,
    fullPage,
    animations: "disabled",
    caret: "hide",
  });
  await writeFile(
    metadataFile(file),
    JSON.stringify({
      browser,
      viewport: width,
      project: info.project.name,
      testFile: path.relative(process.cwd(), info.file),
      testLine: info.line,
    }),
  );
}

export type ReporterOptions = {
  buildName?: string;
  nonce?: string;
  baselineBranch?: string;
  subset?: boolean;
  threshold?: number;
  strict?: boolean;
  uploadOutsideCi?: boolean;
};

export default class StateofpixelReporter implements Reporter {
  private shard: Shard | undefined;

  constructor(private readonly options: ReporterOptions = {}) {}

  printsToStdio(): boolean {
    return false;
  }

  async onBegin(config: FullConfig): Promise<void> {
    this.shard =
      config.shard === null
        ? undefined
        : { index: config.shard.current, total: config.shard.total };
    await rm(snapshotDir(), { recursive: true, force: true });
    await mkdir(snapshotDir(), { recursive: true });
  }

  async onEnd(result: FullResult): Promise<{ status: "failed" } | undefined> {
    if (result.status === "interrupted") {
      return undefined;
    }
    if (!process.env.CI && !this.options.uploadOutsideCi) {
      console.log(
        `stateofpixel: screenshots are in ${path.relative(process.cwd(), snapshotDir())}, uploads run on CI only.`,
      );
      return undefined;
    }
    try {
      await uploadCommand(snapshotDir(), {
        buildName: this.options.buildName,
        shard: this.shard,
        nonce: this.options.nonce,
        baselineBranch: this.options.baselineBranch,
        subset: this.options.subset ?? result.status !== "passed",
        threshold: this.options.threshold,
        strict: this.options.strict ?? false,
        dryRun: false,
      });
      return undefined;
    } catch (error) {
      console.error(
        `stateofpixel: ${error instanceof Error ? error.message : error}`,
      );
      return { status: "failed" };
    }
  }
}
