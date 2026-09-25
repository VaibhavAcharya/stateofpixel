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

On other CI, set `STATEOFPIXEL_TOKEN` to a project token. Creating tokens in the web app comes with the project settings page.

## Commands

| Command | Purpose |
|---|---|
| `stateofpixel upload <dir>` | Upload a folder of PNGs and compare it with the baseline. |
| `stateofpixel finalize` | Finish a build whose shards ran with `--shard auto`. |
| `stateofpixel compare <dir> <baseline-dir>` | Compare two folders locally and write `stateofpixel-report/index.html`. |

Run `stateofpixel <command> --help` for every flag.

## Sharding

With a known shard count, each job runs `stateofpixel upload screenshots --shard 1/4` through `4/4`, and the build finishes when the last shard is done.

When the count is not known, each job runs `stateofpixel upload screenshots --shard auto`, and one last job runs `stateofpixel finalize`. Add `--skip-if-empty` so the check still reports when no shard ran.

## Service errors

When the service is down, `upload` and `finalize` print a warning and exit 0, so our outage does not break your CI. Pass `--strict` to fail instead.

Requires Node 20 or newer.
