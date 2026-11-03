import { Pool } from "@neondatabase/serverless";
import { getDatabase } from "@netlify/database";
import { drizzle as serverlessDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../schema.ts";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const CONNECTION_TIMEOUT_MS = 10 * 1000;
const QUERY_TIMEOUT_MS = 60 * 1000;

let current: Database | undefined;
let currentPool: Pool | undefined;

export function database(): Database {
  if (current === undefined) {
    const connection = getDatabase();
    if (connection.driver === "serverless") {
      currentPool = new Pool({
        connectionString: connection.connectionString,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        query_timeout: QUERY_TIMEOUT_MS,
      });
      current = serverlessDrizzle({
        client: currentPool,
        schema,
        casing: "snake_case",
      });
    } else {
      current = pgDrizzle({
        client: connection.pool,
        schema,
        casing: "snake_case",
      });
    }
  }
  return current;
}

export function closeDatabase() {
  if (currentPool === undefined) {
    return;
  }
  currentPool.end().catch((error: unknown) => {
    console.error("Could not close the database pool", error);
  });
  currentPool = undefined;
  current = undefined;
}

export function useDatabase(db: Database) {
  current = db;
}

export function one<Row>(rows: Row[]): Row {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("Expected one row");
  }
  return row;
}

export function first<Row>(rows: Row[]): Row | null {
  return rows[0] ?? null;
}
