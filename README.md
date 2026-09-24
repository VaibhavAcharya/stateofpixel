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

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
