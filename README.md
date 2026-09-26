# stateofpixel

Visual regression testing that runs in your CI. This README is for working on the repo. CLI usage is in [packages/cli/README.md](packages/cli/README.md).

- [docs/PLAN.md](docs/PLAN.md): why we build it, the stack, costs and risks
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
| Convex deployment | your cloud dev deployment (`packages/backend/.env.local`, pick it with `npx convex dev --configure`) | `graceful-dogfish-423` |
| Web app | http://localhost:3000 | https://stateofpixel.com |
| GitHub App callback URL | `https://<dev deployment>.convex.site/api/auth/callback/github` | `https://graceful-dogfish-423.convex.site/api/auth/callback/github` |
| `SITE_URL` | `http://localhost:3000` | `https://stateofpixel.com` |
| GitHub App webhook URL | not set, the app has one webhook URL | `https://graceful-dogfish-423.convex.site/github/webhook` |
| GitHub App setup URL | | `https://stateofpixel.com/install` |
| Dodo Payments | test mode, webhook `https://<dev deployment>.convex.site/dodo/webhook` | live mode, webhook `https://graceful-dogfish-423.convex.site/dodo/webhook` |

Both deployments need the same Convex env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `IMAGE_URL_SECRET` (a random string, different per deployment, that signs private image links), `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8) and `GITHUB_WEBHOOK_SECRET`. Each deployment has its own JWT key pair. The `GITHUB_*` vars, `SITE_URL` and `IMAGE_URL_SECRET` are declared in `convex/convex.config.ts`, so a push fails while any of them is missing. Compare them with `npx convex env list --names-only` and `npx convex env list --names-only --prod` in `packages/backend`.

Production code deploys from Netlify: its build runs `convex deploy` with `CONVEX_DEPLOY_KEY`, then builds the web app.

Paid plans come from Dodo Payments (SPEC section 8, Billing). Each deployment needs `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET` (the signing secret of its Dodo webhook) and `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` or `live_mode`). These vars are optional in `convex.config.ts`, so a deployment without them still pushes; the pricing section then shows paid plans as coming soon, and billing throws `billing_not_configured`.

To test billing on dev, check out in test mode with a Dodo test card. On production, a 100% discount code entered on checkout gives a real subscription at $0; cancel it afterwards from Manage billing. "Cancel now" moves the account to Free right away, "cancel at next billing date" keeps the plan until then.

To copy env vars from one deployment to another without printing them, run from `packages/backend`:

```sh
npx convex env list --deployment <from> > /tmp/from.env && npx convex env set --deployment <to> --from-file /tmp/from.env; rm -f /tmp/from.env
```

To set a plan by hand, for example `custom`, run from `packages/backend`:

```sh
npx convex run --prod accounts:setPlan '{"login":"acme","plan":"25gb"}'
npx convex run --prod accounts:setPlan '{"login":"acme","plan":"custom","storageLimitBytes":1099511627776}'
```

## CLI

Build the workspace CLI and point it at your dev deployment with a project token from its project settings:

```sh
pnpm --filter stateofpixel build
STATEOFPIXEL_API_URL=https://<dev deployment>.convex.site/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

Without `STATEOFPIXEL_API_URL` it talks to production.

## Dogfooding

`.github/workflows/visual.yml` runs on every PR and uploads three builds to production with the workspace CLI, authenticated with the GitHub Actions OIDC token. So every PR also tests the CLI it changes, and a PR that changes the backend is tested by the old production backend, which keeps the CI API backward compatible:

- `playground`: `examples/playground/pages`, captured by `pnpm --filter @stateofpixel/playground capture`
- `storybook`: the playground stories, built with `pnpm --filter @stateofpixel/playground build-storybook` and captured with `stateofpixel storybook`
- `web`: the public pages and the build page, captured by `pnpm --filter @stateofpixel/web visual` through the Playwright reporter. The reporter uploads on CI only, so a local run only writes screenshots.

The build page is captured from fixtures, so it needs no sign-in or seeded Convex data. In dev, `/lab.stateofpixel/web/builds/1` renders the real build page from the fixture builds in `apps/web/src/components/build/LabBuild.tsx`: build 1 has changes to review, build 2 is storage-blocked. Reviews there change local state only. GitHub logins cannot contain a dot, so the path never matches a real account, and production builds leave the fixtures out.

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
