import { readFile, writeFile } from "node:fs/promises";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { DiffEngine } from "./engine";

export function createPixelmatchEngine(): DiffEngine {
  return {
    name: "pixelmatch",
    async diff(basePath, newPath, diffPath, options) {
      const [base, next] = await Promise.all([
        readPng(basePath),
        readPng(newPath),
      ]);
      const width = Math.max(base.width, next.width);
      const height = Math.max(base.height, next.height);
      const diff = new PNG({ width, height });

      const diffPixels = pixelmatch(
        padTo(base, width, height),
        padTo(next, width, height),
        diff.data,
        width,
        height,
        {
          threshold: options.threshold,
          includeAA: options.includeAA,
          diffMask: true,
        },
      );

      if (diffPixels > 0) {
        await writeFile(diffPath, PNG.sync.write(diff));
      }
      return { diffPixels, diffRatio: diffPixels / (width * height) };
    },
  };
}

async function readPng(filePath: string): Promise<PNG> {
  return PNG.sync.read(await readFile(filePath));
}

function padTo(image: PNG, width: number, height: number): Uint8Array {
  if (image.width === width && image.height === height) {
    return image.data;
  }
  const padded = new Uint8Array(width * height * 4);
  const rowBytes = image.width * 4;
  for (let y = 0; y < image.height; y++) {
    padded.set(
      image.data.subarray(y * rowBytes, (y + 1) * rowBytes),
      y * width * 4,
    );
  }
  return padded;
}
