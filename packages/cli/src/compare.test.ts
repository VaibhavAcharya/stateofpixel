import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compareDirectories, type SnapshotResult } from "./compare";
import type { DiffEngine } from "./diff/engine";
import { createOdiffEngine } from "./diff/odiff";
import { createPixelmatchEngine } from "./diff/pixelmatch";
import {
  blackSquare,
  encodePng,
  pixelAt,
  writeFixture,
} from "./test/png-fixtures";

const engines: [string, () => Promise<DiffEngine>][] = [
  ["odiff", createOdiffEngine],
  ["pixelmatch", async () => createPixelmatchEngine()],
];

describe.each(engines)("compareDirectories with %s", (_, createEngine) => {
  let root: string;
  let outDir: string;
  let results: Map<string, SnapshotResult>;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "stateofpixel-compare-"));
    const dir = path.join(root, "new");
    const baselineDir = path.join(root, "baseline");
    outDir = path.join(root, "report");

    const white = encodePng(40, 30);
    await writeFixture(baselineDir, "same", white);
    await writeFixture(dir, "same", white);
    await writeFixture(baselineDir, "recompressed", encodePng(40, 30));
    await writeFixture(dir, "recompressed", encodePng(40, 30, undefined, 0));
    await writeFixture(baselineDir, "changed", white);
    await writeFixture(dir, "changed", encodePng(40, 30, blackSquare(10)));
    await writeFixture(baselineDir, "resized", white);
    await writeFixture(dir, "resized", encodePng(40, 40));
    await writeFixture(dir, "nested/added", white);
    await writeFixture(baselineDir, "removed", white);

    const list = await compareDirectories({
      dir,
      baselineDir,
      outDir,
      engine: await createEngine(),
      options: { threshold: 0.1, includeAA: false },
    });
    results = new Map(list.map((result) => [result.name, result]));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns every snapshot sorted by name", () => {
    expect([...results.keys()]).toEqual([
      "changed",
      "nested/added",
      "recompressed",
      "removed",
      "resized",
      "same",
    ]);
  });

  it("marks byte-identical snapshots unchanged", () => {
    expect(results.get("same")).toMatchObject({ status: "unchanged" });
  });

  it("marks snapshots with different bytes but the same pixels unchanged", async () => {
    const recompressed = results.get("recompressed");
    expect(recompressed?.status).toBe("unchanged");
    expect(recompressed?.image?.file).not.toBe(
      recompressed?.baselineImage?.file,
    );
    expect(recompressed?.diffImage).toBeUndefined();
  });

  it("reports changed pixels and writes a red diff mask", async () => {
    const changed = results.get("changed");
    expect(changed).toMatchObject({
      status: "changed",
      diffPixels: 100,
      diffRatio: 100 / (40 * 30),
    });

    const diffFile = changed?.diffImage?.file ?? "";
    const diff = PNG.sync.read(await readFile(path.join(outDir, diffFile)));
    expect(pixelAt(diff, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(diff, 30, 20)[3]).toBe(0);
  });

  it("marks snapshots with different dimensions changed", () => {
    expect(results.get("resized")).toMatchObject({
      status: "changed",
      diffPixels: 400,
      image: { width: 40, height: 40 },
      baselineImage: { width: 40, height: 30 },
    });
  });

  it("marks added and removed snapshots", () => {
    expect(results.get("nested/added")).toMatchObject({ status: "added" });
    expect(results.get("nested/added")?.baselineImage).toBeUndefined();
    expect(results.get("removed")).toMatchObject({ status: "removed" });
    expect(results.get("removed")?.image).toBeUndefined();
  });

  it("stores each image once, named by its hash", async () => {
    const files = await readdir(path.join(outDir, "images"));
    expect(files.every((file) => /^[0-9a-f]{64}\.png$/.test(file))).toBe(true);
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain(
      path.basename(results.get("same")?.image?.file ?? ""),
    );
  });
});
