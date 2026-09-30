import { NetlifyDB } from "@netlify/database-dev";

const root = new URL("../../../", import.meta.url).pathname;
const db = new NetlifyDB({ directory: `${root}apps/web/.netlify/db` });
await db.start();
const applied = await db.applyMigrations(
  `${root}apps/web/netlify/database/migrations`,
);
console.log(
  applied.length === 0
    ? "The dev database is up to date."
    : `Applied ${applied.join(", ")}`,
);
await db.stop();
