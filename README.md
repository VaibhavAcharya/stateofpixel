# stateofpixel

Visual regression testing that runs in your CI. This README is for working on the repo. CLI usage is in [packages/cli/README.md](packages/cli/README.md).

- [docs/PLAN.md](docs/PLAN.md): why we build it and how it works
- [docs/SPEC.md](docs/SPEC.md): pages, tables, API, CLI and states in detail
- [docs/DESIGN.md](docs/DESIGN.md): the design system
- [docs/ROADMAP.md](docs/ROADMAP.md): what is done and what is next

## Layout

- `apps/web`: TanStack Start app, deployed on Netlify
- `packages/backend`: Convex functions and schema
- `packages/cli`: the `stateofpixel` CLI and Playwright reporter
- `apps/web/visual`: Playwright tests that capture the web app for dogfooding
- `examples/playground`: static pages and Storybook stories that the test PRs change
- `scripts/test-pr.sh`: opens the dogfooding test PRs

## Development

Node 22 or newer. CI uses the version in `.node-version`.

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs `convex dev` and the web app on http://localhost:3000. The first `convex dev` asks you to log in and pick a Convex project, and writes `packages/backend/.env.local`. The web app reads `CONVEX_URL` from that file.

## Environments

| | Dev | Production |
|---|---|---|
| Convex deployment | your local deployment (`packages/backend/.env.local`) | `graceful-dogfish-423` |
| Web app | http://localhost:3000 | https://stateofpixel.com |
| GitHub App callback URL | `http://127.0.0.1:3211/api/auth/callback/github` | `https://graceful-dogfish-423.convex.site/api/auth/callback/github` |
| `SITE_URL` | `http://localhost:3000` | `https://stateofpixel.com` |
| GitHub App webhook URL | not reachable from GitHub | `https://graceful-dogfish-423.convex.site/github/webhook` |
| GitHub App setup URL | | `https://stateofpixel.com/install` |

Both deployments need the same Convex env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8) and `GITHUB_WEBHOOK_SECRET`. Each deployment has its own JWT key pair. The `GITHUB_*` vars are declared in `convex/convex.config.ts`, so a push fails while any of them is missing. Compare them with `npx convex env list --names-only` and `npx convex env list --names-only --prod` in `packages/backend`.

Production code deploys from Netlify: its build runs `convex deploy` with `CONVEX_DEPLOY_KEY`, then builds the web app.

## CLI

Build the workspace CLI and point it at your local deployment with a project token from the local project settings:

```sh
pnpm --filter stateofpixel build
STATEOFPIXEL_API_URL=http://127.0.0.1:3211/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

Without `STATEOFPIXEL_API_URL` it talks to production.

## Dogfooding

`.github/workflows/visual.yml` uploads three builds to production with the workspace CLI, authenticated with the GitHub Actions OIDC token:

- `playground`: `examples/playground/pages`, captured by `pnpm --filter @stateofpixel/playground capture`
- `storybook`: the playground stories, built with `pnpm --filter @stateofpixel/playground build-storybook` and captured with `stateofpixel storybook`
- `web`: the landing page, captured by `pnpm --filter @stateofpixel/web visual` through the Playwright reporter. The reporter uploads on CI only, so a local run only writes screenshots.

`scripts/test-pr.sh <scenario>` opens a draft PR that changes the playground in a known way and prints the expected check for `playground` and `storybook`. Scenarios: `no-change`, `color-change`, `layout-shift`, `add-page`, `remove-page`, `add-story`, `remove-story`. It needs `gh` signed in.

Netlify deploy previews and branch deploys build only the web app against the production Convex URL. Only production builds run `convex deploy`.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`typecheck` in `apps/web` reads the types from `packages/cli/dist`, so run `pnpm --filter stateofpixel build` first on a fresh checkout, as `ci.yml` does.

## Releases

release-please opens a release PR for `packages/cli` from conventional commits on `main`. Merging it tags the release, and `release.yml` then tests, builds and publishes the CLI to npm.
