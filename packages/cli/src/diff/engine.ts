import { createOdiffEngine } from "./odiff";
import { createPixelmatchEngine } from "./pixelmatch";

export type DiffOptions = {
  threshold: number;
  includeAA: boolean;
};

export type DiffResult = {
  diffPixels: number;
  diffRatio: number;
};

export type DiffEngine = {
  name: "odiff" | "pixelmatch";
  diff(
    basePath: string,
    newPath: string,
    diffPath: string,
    options: DiffOptions,
  ): Promise<DiffResult>;
};

export async function createDiffEngine(): Promise<DiffEngine> {
  try {
    return await createOdiffEngine();
  } catch {
    return createPixelmatchEngine();
  }
}
