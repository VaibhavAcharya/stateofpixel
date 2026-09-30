import { NetlifyDB } from "@netlify/database-dev";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach } from "vitest";
import "../api.ts";
import pg from "pg";
import { type Database, useDatabase } from "../db/index.ts";
import { TEST_CONNECTION_SECRET } from "./fixtures.ts";

const MIGRATIONS = new URL(
  "../../../../apps/web/netlify/database/migrations",
  import.meta.url,
).pathname;

let server: NetlifyDB;
let pool: pg.Pool;
let db: Database;
let tables: string;

beforeAll(async () => {
  process.env.CONNECTION_SECRET = TEST_CONNECTION_SECRET;
  server = new NetlifyDB();
  const connectionString = await server.start();
  await server.applyMigrations(MIGRATIONS);
  pool = new pg.Pool({ connectionString });
  db = useDatabase(pool);
  const { rows } = await server.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  tables = rows.map(({ tablename }) => `"${tablename}"`).join(", ");
});

beforeEach(async () => {
  await db.execute(sql.raw(`truncate ${tables}`));
});

afterAll(async () => {
  await pool.end();
  await server.stop();
});
