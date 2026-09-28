# stateofpixel

[![npm version](https://img.shields.io/npm/v/stateofpixel)](https://www.npmjs.com/package/stateofpixel)
[![npm downloads](https://img.shields.io/npm/dm/stateofpixel)](https://www.npmjs.com/package/stateofpixel)
[![node](https://img.shields.io/node/v/stateofpixel)](https://www.npmjs.com/package/stateofpixel)
[![license](https://img.shields.io/github/license/VaibhavAcharya/stateofpixel)](https://github.com/VaibhavAcharya/stateofpixel/blob/main/LICENSE)

Catch UI regressions before they merge. Upload a folder of screenshots, review the changes on [stateofpixel.com](https://stateofpixel.com), and a GitHub check waits until every change is approved. [Require the check](https://stateofpixel.com/docs/checks#require-it) to block the merge until then.

![The stateofpixel review page, with the baseline and the new screenshot side by side and the changed pixels in green](https://stateofpixel.com/readme/review-page.png)

The docs are at [stateofpixel.com/docs](https://stateofpixel.com/docs).

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

## Playwright

Add the reporter and call `snapshot()` in your tests. The reporter uploads the screenshots when the run ends on CI, so the workflow needs no upload step.

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [["list"], ["stateofpixel/playwright", { buildName: "e2e" }]],
});
```

```ts
// tests/pricing.spec.ts
import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("pricing", async ({ page }) => {
  await page.goto("/pricing");
  await snapshot(page, "Marketing/Pricing");
});
```

See [Playwright](https://stateofpixel.com/docs/playwright). For Storybook, `stateofpixel storybook` captures every story of a built Storybook, see [Storybook](https://stateofpixel.com/docs/storybook). Any other tool works too: folder paths become snapshot names, so `screenshots/Marketing/Pricing.png` is `Marketing/Pricing`.

## Commands

- [`upload <dir>`](https://stateofpixel.com/docs/cli#upload): upload a folder of screenshots and compare it with the baseline
- [`storybook <static-dir>`](https://stateofpixel.com/docs/cli#storybook): capture every story of a built Storybook, then upload
- [`finalize`](https://stateofpixel.com/docs/cli#finalize): finish a build whose shards ran with `--shard auto`
- [`compare <dir> <baseline-dir>`](https://stateofpixel.com/docs/cli#compare): compare two folders locally and write an HTML report

Requires Node 20 or newer.

## Source

The source is in [`packages/cli`](https://github.com/VaibhavAcharya/stateofpixel/tree/main/packages/cli) of [VaibhavAcharya/stateofpixel](https://github.com/VaibhavAcharya/stateofpixel), under the MIT license. Open an [issue](https://github.com/VaibhavAcharya/stateofpixel/issues) for bugs and feature requests, and see [CONTRIBUTING.md](https://github.com/VaibhavAcharya/stateofpixel/blob/main/CONTRIBUTING.md) to send a change.
