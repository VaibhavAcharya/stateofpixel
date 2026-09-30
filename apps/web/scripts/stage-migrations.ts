import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS = "apps/web/netlify/database/migrations";
const DIST = ".netlify/internal/db/migrations";
const MIGRATION = /^\d+_[a-z0-9_-]+$/;

for (const entry of await readdir(MIGRATIONS)) {
  const isDirectory = (await stat(join(MIGRATIONS, entry))).isDirectory();
  const name = isDirectory ? entry : entry.replace(/\.sql$/, "");
  if (!MIGRATION.test(name) || (!isDirectory && !entry.endsWith(".sql"))) {
    continue;
  }
  await mkdir(join(DIST, name), { recursive: true });
  await copyFile(
    isDirectory
      ? join(MIGRATIONS, entry, "migration.sql")
      : join(MIGRATIONS, entry),
    join(DIST, name, "migration.sql"),
  );
  console.log(`Staged migration ${name}`);
}
