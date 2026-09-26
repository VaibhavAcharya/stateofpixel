<p align="center">
  <a href="https://stateofpixel.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/stateofpixel-wordmark-inverse.svg">
      <img alt="stateofpixel" src="apps/web/public/brand/stateofpixel-wordmark.svg" height="40">
    </picture>
  </a>
</p>

<p align="center">Visual regression testing that runs in your CI.</p>

<p align="center">
  <a href="https://stateofpixel.com">Website</a> |
  <a href="https://stateofpixel.com/docs">Docs</a> |
  <a href="https://www.npmjs.com/package/stateofpixel">npm</a> |
  <a href="docs/ROADMAP.md">Roadmap</a>
</p>

<p align="center">
  <a href="https://github.com/VaibhavAcharya/stateofpixel/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/VaibhavAcharya/stateofpixel/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/stateofpixel"><img alt="npm version" src="https://img.shields.io/npm/v/stateofpixel"></a>
</p>

Your CI takes the screenshots. stateofpixel compares them with the last approved ones, shows every change on a review page, and sets a GitHub check that waits until someone approves them.

```
  your CI                          stateofpixel                    pull request
  -------                          ------------                    ------------
  tests write PNGs
  npx stateofpixel upload  ----->  find the baseline
    upload new images only         save the results  ----------->  check: pending
    diff on the runner                                             "2 changes to review"
                                   review page  <----------------  Details
                                   approve  -------------------->  check: success
```

- Works with Playwright, Storybook or any folder of PNG files.
- No secret on GitHub Actions: the CLI signs in with the OIDC token.
- Only images the server does not have yet are uploaded, and images are diffed on your runner.
- The review page has side by side, diff, slider and flip, and every action has a key.
- Approvals carry over when you push again or rebase the pull request.
- Shards of one run join one build and report one check.
- Plans are priced by storage. There are no seats.

## Quick start

Install the GitHub App from [stateofpixel.com](https://stateofpixel.com), then add a step after the one that writes your screenshots:

```yaml
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  id-token: write

jobs:
  visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npx playwright test
      - run: npx stateofpixel upload screenshots
```

The [docs](https://stateofpixel.com/docs) cover the Playwright reporter, Storybook, other CI, sharding, reviewing and the CLI.

## Repository

| Path | What it is |
|---|---|
| `apps/web` | The web app on [TanStack Start](https://tanstack.com/start), deployed on Netlify |
| `apps/web/src/content/docs` | The docs at `/docs`, in MDX |
| `apps/web/visual` | Playwright tests that capture the web app for dogfooding |
| `apps/images` | A Cloudflare Worker that stores and serves images from R2 |
| `packages/backend` | [Convex](https://convex.dev) functions and schema: the CI API, GitHub webhooks, billing and storage |
| `packages/cli` | The `stateofpixel` CLI and Playwright reporter, published to npm |
| `examples/playground` | Static pages and Storybook stories that the test pull requests change |
| `scripts` | `test-pr.sh` opens the dogfooding test pull requests |

Design docs:

- [docs/PLAN.md](docs/PLAN.md): why we build it, the stack, costs and risks
- [docs/SPEC.md](docs/SPEC.md): internals: tables, API, functions, crons and the rules behind the docs
- [docs/DESIGN.md](docs/DESIGN.md): the design system of the web app
- [docs/ROADMAP.md](docs/ROADMAP.md): what is done and what is next
- [docs/OPERATIONS.md](docs/OPERATIONS.md): deployments, secrets, billing and releases
- [AGENTS.md](AGENTS.md): rules for coding agents working in this repo

## Development

Node 22 or newer. CI uses the version in `.node-version`.

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs `convex dev` and the web app on http://localhost:3000. The first `convex dev` asks you to log in and pick a Convex project, and writes `packages/backend/.env.local`. The web app reads `CONVEX_URL` from that file. Signing in needs a GitHub App of your own; [OPERATIONS.md](docs/OPERATIONS.md) lists the env vars it needs.

The build page also renders without GitHub: in dev, `/lab.stateofpixel/web/builds/1` shows it from the fixture builds in `apps/web/src/components/build/LabBuild.tsx`. Build 1 has changes to review, build 2 is storage-blocked. Reviews there change local state only. GitHub logins cannot contain a dot, so the path never matches a real account, and production builds leave the fixtures out.

Components have Storybook stories next to them, including states that are hard to reach against a real backend, like checkout results, plan changes, failed renewals, storage warnings and build states. `pnpm --filter @stateofpixel/web storybook` opens them on http://localhost:6007. `apps/web/.storybook/preview.tsx` mocks the data hooks, and a story sets:

- `parameters.convex`: query results by function name, like `{ "billing:available": true }`. A paginated query takes `{ results, status, loadMore }`.
- `parameters.billing`: the `useBilling` state, like a plan change in progress
- `parameters.auth`: `isLoading` and `isAuthenticated` for `useConvexAuth`
- `parameters.path`: the router location
- `parameters.theme`: `dark` to capture the story in dark mode

The clock is fixed and GitHub avatars are replaced with local images, so screenshots stay the same between runs. Shared fixtures are in `apps/web/src/lib/storyFixtures.tsx`.

To try the CLI against your dev deployment, see [CLI against dev](docs/OPERATIONS.md#cli-against-dev).

## Checks

These are the checks `ci.yml` runs:

```sh
pnpm lint
pnpm --filter stateofpixel build
pnpm typecheck
pnpm test
pnpm build
```

Biome formats and lints; `pnpm format` fixes formatting. `typecheck` in `apps/web` reads the types from `packages/cli/dist`, so build the CLI first on a fresh checkout.

## Dogfooding

`.github/workflows/visual.yml` runs on every pull request and uploads four builds to production with the workspace CLI, authenticated with the GitHub Actions OIDC token. So every pull request also tests the CLI it changes, and a pull request that changes the backend is tested by the old production backend, which keeps the CI API backward compatible:

- `playground`: `examples/playground/pages`, captured by `pnpm --filter @stateofpixel/playground capture`
- `storybook`: the playground stories, built with `pnpm --filter @stateofpixel/playground build-storybook` and captured with `stateofpixel storybook`
- `web`: the public pages and the build page, captured by `pnpm --filter @stateofpixel/web visual` through the Playwright reporter. The reporter uploads on CI only, so a local run only writes screenshots.
- `web-storybook`: the web app stories, built with `pnpm --filter @stateofpixel/web build-storybook` and captured with `stateofpixel storybook` at 375 and 1280 wide

`scripts/test-pr.sh <scenario>` opens a draft pull request that changes the playground in a known way and prints the expected check for `playground` and `storybook`. Scenarios: `no-change`, `color-change`, `layout-shift`, `add-page`, `remove-page`, `add-story`, `remove-story`, `flaky`, `many-changes`, `sharded`. `sharded` changes `visual.yml` in its branch: `playground` uploads with `--shard auto` and then `finalize`, `storybook` with `--shard 1/2` and `2/2`. It needs `gh` signed in.

## Contributing

- Commit titles are [conventional commits](https://www.conventionalcommits.org), because release-please builds the CLI changelog from them.
- When user-facing behavior changes, update its page in `apps/web/src/content/docs` in the same change. When internals change, update [SPEC.md](docs/SPEC.md).
- Limits, check states, CLI flags and keyboard shortcuts render in the docs from code. Change the code, not the docs text.
- Run the checks above before opening a pull request.
