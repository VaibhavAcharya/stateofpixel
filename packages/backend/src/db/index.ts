import { getDatabase } from "@netlify/database";
import { drizzle as serverlessDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "../schema.ts";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let current: Database | undefined;

export function database(): Database {
  if (current === undefined) {
    const connection = getDatabase();
    current =
      connection.driver === "serverless"
        ? serverlessDrizzle({
            client: connection.pool,
            schema,
            casing: "snake_case",
          })
        : pgDrizzle({ client: connection.pool, schema, casing: "snake_case" });
  }
  return current;
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
