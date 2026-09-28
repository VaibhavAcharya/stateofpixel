import { copyFile, mkdir, readFile, rename, rm } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import type { DiffEngine, DiffOptions } from "./diff/engine";
import { mapConcurrent } from "./map-concurrent";
import { readPngSize, sha256 } from "./png";
import { collectSnapshots } from "./snapshots";

export type SnapshotStatus = "unchanged" | "changed" | "added" | "removed";

export type ImageRef = {
  file: string;
  width: number;
  height: number;
};

export type SnapshotResult = {
  name: string;
  status: SnapshotStatus;
  image?: ImageRef;
  baselineImage?: ImageRef;
  diffImage?: ImageRef;
  diffPixels?: number;
  diffRatio?: number;
};

type CompareDirectoriesInput = {
  dir: string;
  baselineDir: string;
  outDir: string;
  engine: DiffEngine;
  options: DiffOptions;
};

export async function compareDirectories({
  dir,
  baselineDir,
  outDir,
  engine,
  options,
}: CompareDirectoriesInput): Promise<SnapshotResult[]> {
  const [snapshots, baselines] = await Promise.all([
    collectSnapshots(dir),
    collectSnapshots(baselineDir),
  ]);
  const imagesDir = path.join(outDir, "images");
  const workDir = path.join(outDir, ".work");
  await mkdir(imagesDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const names = [...new Set([...snapshots.keys(), ...baselines.keys()])].sort(
    (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  );

  const results = await mapConcurrent(
    names,
    availableParallelism(),
    async (name, index): Promise<SnapshotResult> => {
      const filePath = snapshots.get(name);
      const baselinePath = baselines.get(name);

      if (!filePath && baselinePath) {
        return {
          name,
          status: "removed",
          baselineImage: await storeImage(baselinePath, imagesDir),
        };
      }
      if (!filePath) {
        throw new Error(`Snapshot ${name} has no file`);
      }

      const image = await storeImage(filePath, imagesDir);
      if (!baselinePath) {
        return { name, status: "added", image };
      }

      const baselineImage = await storeImage(baselinePath, imagesDir);
      if (image.file === baselineImage.file) {
        return { name, status: "unchanged", image, baselineImage };
      }

      const workPath = path.join(workDir, `${index}.png`);
      const { diffPixels, diffRatio } = await engine.diff(
        baselinePath,
        filePath,
        workPath,
        options,
      );
      if (diffPixels === 0) {
        await rm(workPath, { force: true });
        return { name, status: "unchanged", image, baselineImage };
      }

      return {
        name,
        status: "changed",
        image,
        baselineImage,
        diffImage: await storeImage(workPath, imagesDir, { move: true }),
        diffPixels,
        diffRatio,
      };
    },
  );

  await rm(workDir, { recursive: true, force: true });
  return results;
}

async function storeImage(
  filePath: string,
  imagesDir: string,
  { move = false } = {},
): Promise<ImageRef> {
  const bytes = await readFile(filePath);
  const file = `images/${sha256(bytes)}.png`;
  const target = path.join(imagesDir, path.basename(file));
  if (move) {
    await rename(filePath, target);
  } else {
    await copyFile(filePath, target);
  }
  return { file, ...readPngSize(bytes) };
}
