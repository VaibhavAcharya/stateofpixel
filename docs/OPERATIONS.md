# Operations

How the maintainers run stateofpixel: deployments, secrets, billing, releases and the test repo. For working on the code, see the [README](../README.md).

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
| Images Worker | `https://stateofpixel-images-dev.vaibhavacharya1116816.workers.dev`, R2 bucket `stateofpixel-images-dev` | `https://stateofpixel-images.vaibhavacharya1116816.workers.dev`, R2 bucket `stateofpixel-images` |

Both deployments need the same Convex env vars: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `IMAGE_URL_SECRET` (a random string, different per deployment, that signs private image links), `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (PKCS#8) and `GITHUB_WEBHOOK_SECRET`. Each deployment has its own JWT key pair. The `GITHUB_*` vars, `SITE_URL` and `IMAGE_URL_SECRET` are declared in `convex/convex.config.ts`, so a push fails while any of them is missing. Compare them with `npx convex env list --names-only` and `npx convex env list --names-only --prod` in `packages/backend`.

Production code deploys from Netlify: its build runs `convex deploy` with `CONVEX_DEPLOY_KEY`, then builds the web app.

Paid plans come from Dodo Payments (SPEC section 8, Billing). Each deployment needs `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET` (the signing secret of its Dodo webhook) and `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` or `live_mode`). These vars are optional in `convex.config.ts`, so a deployment without them still pushes; the pricing section then shows paid plans as coming soon, and billing throws `billing_not_configured`.

New images go to Cloudflare R2 through the Worker in `apps/images` when the Convex env var `IMAGES_URL` is set to the Worker URL (SPEC section 11). Without it, uploads go to Convex File Storage. To set up an environment, run from `apps/images` after `npx wrangler login`:

```sh
npx wrangler r2 bucket create stateofpixel-images-dev
npx wrangler secret put IMAGE_URL_SECRET
pnpm deploy:dev
```

The secret must be the same value as `IMAGE_URL_SECRET` in that Convex deployment. Then set `IMAGES_URL` in Convex to the `workers.dev` URL that `pnpm deploy:dev` prints. For production, use bucket `stateofpixel-images`, `npx wrangler secret put IMAGE_URL_SECRET --env production` and `pnpm deploy:prod`. The Worker deploys by hand, not from Netlify.

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

Netlify deploy previews and branch deploys build only the web app against the production Convex URL. Only production builds run `convex deploy`.

## CLI against dev

Build the workspace CLI and point it at your dev deployment with a project token from its project settings:

```sh
pnpm --filter stateofpixel build
STATEOFPIXEL_API_URL=https://<dev deployment>.convex.site/api/v1 STATEOFPIXEL_TOKEN=sop_... \
  node packages/cli/dist/index.mjs upload <dir>
```

Without `STATEOFPIXEL_API_URL` it talks to production.

## Merge scenarios

Merge scenarios run against the private repo [`VaibhavAcharya/stateofpixel-test`](https://github.com/VaibhavAcharya/stateofpixel-test). Its workflow uploads `shots/*.png` to the dev deployment with the published CLI, and `python3 scripts/png.py <name> <hex color>` recolors a shot. The GitHub App sends webhooks to production only, so after adding a repo to the installation, run `npx convex run installations:sync '{"installationId": <id>}'` in `packages/backend` to create its dev project.

## Releases

release-please opens a release PR for `packages/cli` from conventional commits on `main`. Merging it tags the release, and `release.yml` then tests, builds and publishes the CLI to npm.
