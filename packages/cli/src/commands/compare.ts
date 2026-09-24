import { stat } from "node:fs/promises";
import path from "node:path";
import { InvalidArgumentError } from "commander";
import { compareDirectories, type SnapshotStatus } from "../compare";
import { createDiffEngine } from "../diff/engine";
import { writeReport } from "../report/write-report";

export type CompareCommandOptions = {
  out: string;
  threshold: number;
  includeAa: boolean;
};

export async function compareCommand(
  dir: string,
  baselineDir: string,
  options: CompareCommandOptions,
): Promise<void> {
  await assertDirectory(dir);
  await assertDirectory(baselineDir);

  const startedAt = performance.now();
  const engine = await createDiffEngine();
  const results = await compareDirectories({
    dir,
    baselineDir,
    outDir: options.out,
    engine,
    options: { threshold: options.threshold, includeAA: options.includeAa },
  });
  const reportPath = await writeReport(options.out, results, {
    dir,
    baselineDir,
    engine: engine.name,
    createdAt: new Date().toISOString(),
  });

  const counts = countByStatus(results.map((result) => result.status));
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`stateofpixel  compare  ${dir} vs ${baselineDir}`);
  console.log(
    `  ${formatCount(results.length)} snapshots  ${formatCount(counts.unchanged)} unchanged  ${formatCount(counts.changed)} changed  ${formatCount(counts.added)} added  ${formatCount(counts.removed)} removed`,
  );
  console.log(`  compared with ${engine.name} in ${seconds} s`);
  console.log(`  report: ${path.relative(process.cwd(), reportPath)}`);
}

export function parseThreshold(value: string): number {
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new InvalidArgumentError("Must be a number from 0 to 1.");
  }
  return threshold;
}

async function assertDirectory(dir: string): Promise<void> {
  const stats = await stat(dir).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
}

function countByStatus(
  statuses: SnapshotStatus[],
): Record<SnapshotStatus, number> {
  const counts = { unchanged: 0, changed: 0, added: 0, removed: 0 };
  for (const status of statuses) {
    counts[status]++;
  }
  return counts;
}

function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}
