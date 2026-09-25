# stateofpixel

Visual regression testing that runs in your CI. Upload a folder of screenshots, review the changes on [stateofpixel.com](https://stateofpixel.com), and a GitHub check blocks the merge until every change is approved.

## GitHub Actions

Install the GitHub App from [stateofpixel.com](https://stateofpixel.com), then add a step after the one that writes your screenshots:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - run: npx playwright test
  - run: npx stateofpixel upload screenshots
```

On other CI, set `STATEOFPIXEL_TOKEN` to a project token. Admins create tokens in the project settings on stateofpixel.com.

## Commands

| Command | Purpose |
|---|---|
| `stateofpixel upload <dir>` | Upload a folder of PNGs and compare it with the baseline. |
| `stateofpixel storybook <static-dir>` | Capture every story of a built Storybook, then upload. |
| `stateofpixel finalize` | Finish a build whose shards ran with `--shard auto`. |
| `stateofpixel compare <dir> <baseline-dir>` | Compare two folders locally and write `stateofpixel-report/index.html`. |

Run `stateofpixel <command> --help` for every flag.

A `<name>.meta.json` next to `<name>.png` is sent as that snapshot's metadata and shown on the review page.

## Storybook

`storybook` and the Playwright reporter need Playwright in your project: `npm install -D playwright`, then `npx playwright install chromium`.

```yaml
  - run: npx storybook build
  - run: npx stateofpixel storybook storybook-static --viewports 375,1280
```

Each story is captured at every viewport width and named `Title/Name [chromium 1280]`. Filter with `--include` and `--exclude` globs on `Title/Name`, and use `--wait-for-selector` and `--delay` for stories that render late.

## Playwright

```ts
// playwright.config.ts
reporter: [["list"], ["stateofpixel/playwright"]]

// in a test
import { snapshot } from "stateofpixel/playwright";
await snapshot(page, "Checkout/Empty cart");
```

`snapshot` waits for fonts, disables animations, hides the caret, and saves a full-page screenshot named `Checkout/Empty cart [chromium 1280]` into `stateofpixel-screenshots`. The reporter uploads that folder when the run ends, once per shard when Playwright sharding is on. It uploads on CI only (when `CI` is set); pass `{ uploadOutsideCi: true }` as reporter options to upload from your machine. When a test fails, the upload is marked as a subset so skipped snapshots are not reported as removed.

## Sharding

With a known shard count, each job runs `stateofpixel upload screenshots --shard 1/4` through `4/4`, and the build finishes when the last shard is done.

When the count is not known, each job runs `stateofpixel upload screenshots --shard auto`, and one last job runs `stateofpixel finalize`. Add `--skip-if-empty` so the check still reports when no shard ran.

## Service errors

When the service is down, or a rate limit is hit, `upload` and `finalize` print a warning and exit 0, so our outage does not break your CI. Pass `--strict` to fail instead.

## Limits

- 20,000 snapshots and 256 shards per build.
- 20 MB and 10,000 x 50,000 px per image. Bigger images are rejected, their snapshots fail and `upload` exits 1.
- 512 characters per snapshot name, 4 KB of metadata per snapshot.
- 2,000 builds and 20 GB of uploads per account per day, 600 requests per minute per token.

When an account passes 80% of its storage, the CLI prints a warning. After 14 days over the limit, new images are not stored and the check is neutral, so CI keeps passing.

Requires Node 20 or newer.
