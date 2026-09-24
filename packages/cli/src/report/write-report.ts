import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SnapshotResult } from "../compare";
import { renderReport } from "./template";

export type ReportMeta = {
  dir: string;
  baselineDir: string;
  engine: string;
  createdAt: string;
};

export async function writeReport(
  outDir: string,
  results: SnapshotResult[],
  meta: ReportMeta,
): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, "index.html");
  await writeFile(reportPath, renderReport(results, meta));
  return reportPath;
}
