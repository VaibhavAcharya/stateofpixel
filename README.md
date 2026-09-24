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

Both deployments need the same Convex env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL`. Each deployment has its own JWT key pair. Compare them with `npx convex env list --names-only` and `npx convex env list --names-only --prod` in `packages/backend`.

Production code deploys from Netlify: its build runs `convex deploy` with `CONVEX_DEPLOY_KEY`, then builds the web app.

## CLI

```sh
pnpm --filter stateofpixel build
node packages/cli/dist/index.mjs compare <dir> <baseline-dir>
```

`compare` writes `stateofpixel-report/index.html`. Options: `--out <dir>`, `--threshold <0-1>` (default 0.1), `--include-aa`.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
