# Backend

`packages/backend/src` holds the backend that the web app runs: queries, mutations and actions in `src/*.ts`, the Postgres schema in `src/schema.ts` and the HTTP routes in `src/http.ts`.

- Functions are defined with `query`, `mutation` and `action` (and their `internal*` versions) from `src/server.ts` and registered in `src/api.ts`. Public ones are callable from the browser through `/api/rpc`, so check permissions in every public function.
- Mutations run in a serializable transaction that is retried on conflict. Actions call GitHub, Dodo or Blobs and use `ctx.runQuery` and `ctx.runMutation` for the database.
- `ctx.scheduler` writes jobs to the `jobs` table in the same transaction. The `jobs-background` Netlify Function runs due jobs; scheduled functions in `apps/web/functions` enqueue the daily jobs. The web build bundles them into `apps/web/netlify/functions`.
- The database is Netlify Database (Postgres), accessed with Drizzle. Optional columns are `null`, never `undefined`. Use `first` and `one` from `src/db` instead of non-null assertions.
- Schema changes need a migration: `pnpm --filter @stateofpixel/backend db:generate --name <change>`.
- Tests use `testBackend()` from `src/test/backend.ts` against a local Postgres.
