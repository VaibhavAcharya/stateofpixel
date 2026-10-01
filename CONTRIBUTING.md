# Contributing

Open an [issue](https://github.com/VaibhavAcharya/stateofpixel/issues) for bugs and feature requests, and talk about larger changes there before opening a pull request. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Development

Node 22 or newer. CI uses the version in `.node-version`.

```sh
pnpm install
```

Run the app with the [Netlify CLI](https://docs.netlify.com/cli/get-started/) from `apps/web`, linked to a Netlify site of your own:

```sh
cd apps/web
netlify link
netlify dev
```

`netlify dev` needs Netlify CLI 27 or newer. It runs `pnpm dev` behind http://localhost:8888 with a local Postgres database, Netlify Blobs and Netlify Identity. `pnpm dev` alone has none of those, so use `netlify dev`.

Apply the migrations with `pnpm --filter @stateofpixel/backend db:migrate` while `netlify dev` is stopped, and again after pulling schema changes. In this monorepo, `netlify database migrations apply` writes to a different local database than the one `netlify dev` uses, so do not use it here.

Signing in needs Identity enabled on your site with the GitHub provider, and optionally Google. Repositories need a GitHub App of your own, see [Environment variables](#environment-variables).

In dev, `/lab.stateofpixel/web/builds/1` renders the build page from the fixtures in `apps/web/src/components/build/LabBuild.tsx`, without GitHub. Reviews there change local state only.

Components have Storybook stories next to them. `pnpm --filter @stateofpixel/web storybook` opens them on http://localhost:6007. `apps/web/.storybook/preview.tsx` mocks the data hooks, and shared fixtures are in `apps/web/src/lib/storyFixtures.tsx`.

To try the CLI against your dev server, build it and pass a project token from the project settings:

```sh
pnpm --filter stateofpixel build
STATEOFPIXEL_API_URL=http://localhost:8888/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

Without `STATEOFPIXEL_API_URL` it talks to production.

### Environment variables

Set these on your Netlify site with `netlify env:set`; `netlify dev` loads them. `packages/backend/src/env.ts` reads them and throws when a required one is missing.

- `SITE_URL`: `http://localhost:8888` in dev
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8), `GITHUB_WEBHOOK_SECRET`: your GitHub App. Its webhook URL is `<SITE_URL>/api/github/webhook`, which GitHub cannot reach on localhost without a tunnel. It needs these permissions: Commit statuses write, Pull requests read, Contents read, Metadata read and, on the account, Email addresses read. Subscribe it to the `pull_request` and `repository` events.
- `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`: the same GitHub App, for connecting a GitHub account. Its callback URLs are `<SITE_URL>/api/github/callback` and `https://identity.services.netlify.com/callback`, for signing in with GitHub through Identity. Keep user-to-server token expiration on, so connections get refresh tokens.
- `CONNECTION_SECRET`: a random string that encrypts GitHub tokens in the database. Set it for the production context only, so deploy previews, whose database branches copy production data, cannot read the tokens.
- `IMAGE_URL_SECRET`: a random string that signs image uploads and private image links.
- `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` or `live_mode`): optional. Without them the pricing section shows paid plans as coming soon. The Dodo webhook URL is `<SITE_URL>/api/dodo/webhook`.

## Checks

Run what `ci.yml` runs before opening a pull request:

```sh
pnpm lint
pnpm --filter stateofpixel build
pnpm typecheck
pnpm test
pnpm build
```

Biome formats and lints; `pnpm format` fixes formatting. Backend tests run the migrations on an in-process Postgres ([PGlite](https://pglite.dev)), so they need no setup.

After changing `packages/backend/src/schema.ts`, run `pnpm --filter @stateofpixel/backend db:generate --name <change>` to write a migration to `apps/web/netlify/database/migrations`. Netlify applies new migrations before it publishes a deploy. `typecheck` in `apps/web` reads the types from `packages/cli/dist`, so build the CLI first on a fresh checkout.

`visual.yml` uploads screenshots of the playground and the web app to stateofpixel with the workspace CLI. It runs on pull requests from branches of this repo and is skipped on forks, since it needs this repo's OIDC token.

## Pull requests

- Commit titles are [conventional commits](https://www.conventionalcommits.org), because release-please builds the CLI changelog from them.
- When user-facing behavior changes, update its page in `apps/web/src/content/docs` in the same change.
- Limits, check states, CLI flags and keyboard shortcuts render in the docs from code. Change the code, not the docs text.
