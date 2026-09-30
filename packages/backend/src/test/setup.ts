import { PGlite } from "@electric-sql/pglite";
import { applyMigrations } from "@netlify/database-dev";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach } from "vitest";
import "../api.ts";
import { type Database, useDatabase } from "../db/index.ts";
import * as schema from "../schema.ts";
import { TEST_CONNECTION_SECRET } from "./fixtures.ts";

const MIGRATIONS = new URL(
  "../../../../apps/web/netlify/database/migrations",
  import.meta.url,
).pathname;

let client: PGlite;
let db: Database;
let tables: string;

beforeAll(async () => {
  process.env.CONNECTION_SECRET = TEST_CONNECTION_SECRET;
  client = new PGlite();
  await applyMigrations(client, MIGRATIONS);
  db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Database;
  useDatabase(db);
  const { rows } = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  tables = rows.map(({ tablename }) => `"${tablename}"`).join(", ");
});

beforeEach(async () => {
  await db.execute(sql.raw(`truncate ${tables}`));
});

afterAll(async () => {
  await client.close();
});
