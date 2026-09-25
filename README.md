# stateofpixel

Visual regression testing that runs in your CI. See [docs/PLAN.md](docs/PLAN.md) and [docs/SPEC.md](docs/SPEC.md).

## Layout

- `apps/web`: TanStack Start app, deployed on Netlify
- `packages/backend`: Convex functions and schema
- `packages/cli`: the `stateofpixel` CLI

## Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs `convex dev` and the web app on http://localhost:3000. The first `convex dev` asks you to log in and pick a Convex project, and writes `packages/backend/.env.local`. The web app reads `CONVEX_URL` from that file.

## Environments

| | Dev | Production |
|---|---|---|
| Convex deployment | your local deployment (`packages/backend/.env.local`) | `graceful-dogfish-423` |
| Web app | http://localhost:3000 | https://stateofpixel.netlify.app |
| GitHub App callback URL | `http://127.0.0.1:3211/api/auth/callback/github` | `https://graceful-dogfish-423.convex.site/api/auth/callback/github` |
| `SITE_URL` | `http://localhost:3000` | `https://stateofpixel.netlify.app` |
| GitHub App webhook URL | not reachable from GitHub | `https://graceful-dogfish-423.convex.site/github/webhook` |
| GitHub App setup URL | | `https://stateofpixel.netlify.app/install` |

Both deployments need the same Convex env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8) and `GITHUB_WEBHOOK_SECRET`. Each deployment has its own JWT key pair. The `GITHUB_*` vars are declared in `convex/convex.config.ts`, so a push fails while any of them is missing. Compare them with `npx convex env list --names-only` and `npx convex env list --names-only --prod` in `packages/backend`.

Production code deploys from Netlify: its build runs `convex deploy` with `CONVEX_DEPLOY_KEY`, then builds the web app.

## CLI

```sh
pnpm --filter stateofpixel build
node packages/cli/dist/index.mjs compare <dir> <baseline-dir>
```

`compare` writes `stateofpixel-report/index.html`. Options: `--out <dir>`, `--threshold <0-1>` (default 0.1), `--include-aa`.

```sh
STATEOFPIXEL_API_URL=http://127.0.0.1:3211/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

`upload` uses the GitHub Actions OIDC token when `id-token: write` is granted, else `STATEOFPIXEL_TOKEN`. Without `STATEOFPIXEL_API_URL` it talks to production. Run `upload --help` for flags.

## Dogfooding

`.github/workflows/visual.yml` captures `examples/playground/pages` with Playwright and uploads them to production with the workspace CLI, as build name `playground`. It authenticates with the GitHub Actions OIDC token.

`scripts/test-pr.sh <scenario>` opens a draft PR that changes the playground in a known way and states the expected check. Scenarios: `no-change`, `color-change`, `layout-shift`, `add-page`, `remove-page`. It needs `gh` signed in.

Netlify deploy previews and branch deploys build only the web app against the production Convex URL. Only production builds run `convex deploy`.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
