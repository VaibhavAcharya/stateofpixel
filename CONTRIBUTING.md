# Contributing

Open an [issue](https://github.com/VaibhavAcharya/stateofpixel/issues) for bugs and feature requests, and talk about larger changes there before opening a pull request. To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Development

Node 22 or newer. CI uses the version in `.node-version`.

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs `convex dev` and the web app on http://localhost:3000. The first `convex dev` asks you to log in and pick a Convex project, and writes `packages/backend/.env.local`. The web app reads `CONVEX_URL` from that file. Signing in needs a GitHub App of your own, see [Environment variables](#environment-variables).

In dev, `/lab.stateofpixel/web/builds/1` renders the build page from the fixtures in `apps/web/src/components/build/LabBuild.tsx`, without GitHub. Reviews there change local state only.

Components have Storybook stories next to them. `pnpm --filter @stateofpixel/web storybook` opens them on http://localhost:6007. `apps/web/.storybook/preview.tsx` mocks the data hooks, and shared fixtures are in `apps/web/src/lib/storyFixtures.tsx`.

To try the CLI against your dev deployment, build it and pass a project token from the project settings:

```sh
pnpm --filter stateofpixel build
STATEOFPIXEL_API_URL=https://<dev deployment>.convex.site/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

Without `STATEOFPIXEL_API_URL` it talks to production.

### Environment variables

Set these on your Convex deployment with `npx convex env set` in `packages/backend`. `convex/convex.config.ts` declares the `GITHUB_*`, `SITE_URL`, `IMAGE_URL_SECRET` and `DODO_*` vars, so a push fails while a required one is missing.

- `SITE_URL`: `http://localhost:3000` in dev
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`: the client ID and secret of your GitHub App. Its callback URL is `https://<dev deployment>.convex.site/api/auth/callback/github`.
- `JWT_PRIVATE_KEY`, `JWKS`: the Convex Auth key pair, generated as in its [manual setup](https://labs.convex.dev/auth/setup/manual)
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8), `GITHUB_WEBHOOK_SECRET`: the same GitHub App. Its webhook URL is `https://<dev deployment>.convex.site/github/webhook`.
- `IMAGE_URL_SECRET`: a random string that signs private image links
- `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` or `live_mode`): optional. Without them the pricing section shows paid plans as coming soon.

## Checks

Run what `ci.yml` runs before opening a pull request:

```sh
pnpm lint
pnpm --filter stateofpixel build
pnpm typecheck
pnpm test
pnpm build
```

Biome formats and lints; `pnpm format` fixes formatting. `typecheck` in `apps/web` reads the types from `packages/cli/dist`, so build the CLI first on a fresh checkout.

`visual.yml` uploads screenshots of the playground and the web app to stateofpixel with the workspace CLI. It runs on pull requests from branches of this repo and is skipped on forks, since it needs this repo's OIDC token.

## Pull requests

- Commit titles are [conventional commits](https://www.conventionalcommits.org), because release-please builds the CLI changelog from them.
- When user-facing behavior changes, update its page in `apps/web/src/content/docs` in the same change.
- Limits, check states, CLI flags and keyboard shortcuts render in the docs from code. Change the code, not the docs text.
