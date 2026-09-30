import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "../../apps/web/netlify/database/migrations",
  casing: "snake_case",
  migrations: { prefix: "timestamp" },
});
