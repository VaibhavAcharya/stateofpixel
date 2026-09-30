<p align="center">
  <a href="https://stateofpixel.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/stateofpixel-wordmark-inverse.svg">
      <img alt="stateofpixel" src="apps/web/public/brand/stateofpixel-wordmark.svg" height="40">
    </picture>
  </a>
</p>

<p align="center">Catch UI regressions before they merge.</p>

<p align="center">
  <a href="https://stateofpixel.com">Website</a> |
  <a href="https://stateofpixel.com/docs">Docs</a> |
  <a href="https://www.npmjs.com/package/stateofpixel">npm</a>
</p>

<p align="center">
  <a href="https://github.com/VaibhavAcharya/stateofpixel/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/VaibhavAcharya/stateofpixel/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/stateofpixel"><img alt="npm version" src="https://img.shields.io/npm/v/stateofpixel"></a>
  <a href="https://app.netlify.com/projects/stateofpixel/deploys"><img alt="Netlify status" src="https://api.netlify.com/api/v1/badges/2038e0c8-2708-494b-b881-1b70f9b7b0e6/deploy-status"></a>
</p>

Your CI takes the screenshots. stateofpixel compares them with the last approved ones, shows every change on a review page, and sets a GitHub check that waits until someone approves them.

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
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - run: npx playwright test
      - run: npx stateofpixel upload screenshots
```

The [docs](https://stateofpixel.com/docs) cover the Playwright reporter, Storybook, other CI, sharding, reviewing and the CLI.

## Repository

| Path | What it is |
|---|---|
| `apps/web` | The web app on [Netlify](https://www.netlify.com), built with [TanStack Start](https://tanstack.com/start). Image uploads run in Netlify Functions, and new accounts store images in Netlify Blobs |
| `apps/web/src/content/docs` | The docs at `/docs`, in MDX |
| `apps/web/visual` | Playwright tests that capture the web app for dogfooding |
| `packages/backend` | The CI API, GitHub webhooks, billing and the database schema |
| `packages/cli` | The `stateofpixel` CLI and Playwright reporter, published to npm |
| `examples/playground` | Static pages and Storybook stories that the test pull requests change |
| `scripts` | `test-pr.sh` opens the dogfooding test pull requests |

- [docs/DESIGN.md](docs/DESIGN.md): the design system of the web app
- [CONTRIBUTING.md](CONTRIBUTING.md): development, environment variables, checks and pull requests
- [ROADMAP.md](ROADMAP.md): planned improvements
- [AGENTS.md](AGENTS.md): rules for coding agents working in this repo

## License

[MIT](LICENSE)
