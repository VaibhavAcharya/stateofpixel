# stateofpixel

Visual regression testing that runs in your CI. Upload a folder of screenshots, review the changes on [stateofpixel.com](https://stateofpixel.com), and a GitHub check blocks the merge until every change is approved.

The docs are at [stateofpixel.com/docs](https://stateofpixel.com/docs): Playwright, Storybook, other CI, sharding, the CLI reference and limits.

## GitHub Actions

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

On other CI, set `STATEOFPIXEL_TOKEN` to a project token from the project settings on stateofpixel.com.

Requires Node 20 or newer.
