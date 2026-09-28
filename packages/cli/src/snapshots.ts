import { readdir } from "node:fs/promises";
import path from "node:path";

export async function collectSnapshots(
  dir: string,
): Promise<Map<string, string>> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const snapshots = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) {
      continue;
    }
    const filePath = path.join(entry.parentPath, entry.name);
    snapshots.set(snapshotName(dir, filePath), filePath);
  }

  return new Map(
    [...snapshots].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function snapshotName(dir: string, filePath: string): string {
  const relativePath = path.relative(dir, filePath).split(path.sep).join("/");
  return relativePath.slice(0, -".png".length);
}
