# stateofpixel

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

## Any folder of screenshots

```sh
npx stateofpixel upload screenshots
```

Folder paths become snapshot names, so `screenshots/Marketing/Pricing.png` is `Marketing/Pricing`. See [Any screenshots](https://stateofpixel.com/docs/any-screenshots).

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

See [Playwright](https://stateofpixel.com/docs/playwright).

## Storybook

Capture every story of a built Storybook at each width and upload them in one command. The capture uses the Playwright in your project:

```sh
npm install -D stateofpixel playwright
npx playwright install chromium
npx storybook build
npx stateofpixel storybook storybook-static --viewports 375,1280
```

See [Storybook](https://stateofpixel.com/docs/storybook).

## Commands

- [`upload <dir>`](https://stateofpixel.com/docs/cli#upload): upload a folder of screenshots and compare it with the baseline
- [`storybook <static-dir>`](https://stateofpixel.com/docs/cli#storybook): capture every story of a built Storybook, then upload
- [`finalize`](https://stateofpixel.com/docs/cli#finalize): finish a build whose shards ran with `--shard auto`
- [`compare <dir> <baseline-dir>`](https://stateofpixel.com/docs/cli#compare): compare two folders locally and write an HTML report

Requires Node 20 or newer.
