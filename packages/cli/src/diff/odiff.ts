import { open } from "node:fs/promises";
import { createRequire } from "node:module";
import { readPngSize } from "../png";
import type { DiffEngine } from "./engine";

export async function createOdiffEngine(): Promise<DiffEngine> {
  const require = createRequire(import.meta.url);
  const { findBinary } = require("odiff-bin/binary.js") as {
    findBinary(): string;
  };
  findBinary();
  const { compare } = await import("odiff-bin");

  return {
    name: "odiff",
    async diff(basePath, newPath, diffPath, options) {
      const result = await compare(basePath, newPath, diffPath, {
        threshold: options.threshold,
        antialiasing: !options.includeAA,
        outputDiffMask: true,
      });

      if (result.match) {
        return { diffPixels: 0, diffRatio: 0 };
      }
      if (result.reason === "pixel-diff") {
        const [base, next] = await Promise.all([
          readPngSizeFromFile(basePath),
          readPngSizeFromFile(newPath),
        ]);
        const pixels =
          Math.max(base.width, next.width) * Math.max(base.height, next.height);
        return {
          diffPixels: result.diffCount,
          diffRatio: result.diffCount / pixels,
        };
      }
      throw new Error(`odiff could not compare ${newPath}: ${result.reason}`);
    },
  };
}

async function readPngSizeFromFile(
  filePath: string,
): Promise<{ width: number; height: number }> {
  const file = await open(filePath);
  try {
    const { buffer } = await file.read(Buffer.alloc(24), 0, 24, 0);
    return readPngSize(buffer);
  } finally {
    await file.close();
  }
}
