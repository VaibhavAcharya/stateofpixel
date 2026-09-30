# Records

Measurements and events, with dates and sources, to use later. Newest first. This file is in the public repo but is not rendered on the website.

## 2026-09-30: CI upload speed after the move to Netlify Database

Source: the `uploaded N images (X MB) in S s` line the CLI prints in `visual.yml` runs, and the request log line added in #72.

The same `scripts/test-pr.sh many-changes` scenario, before and after each change:

| Change | Test PR | playground upload | storybook upload |
| --- | --- | --- | --- |
| Before, first run on Netlify Database | #69 | 17 s step | 12 s step |
| Batch snapshot and image queries (86e06f0) | #70 | 3.6 s | 3.4 s |
| Finalize in the completing request (#72) | #73 | 2.3 s | 2.4 s |

The #69 numbers are GitHub step durations. The storybook step includes about 3 s of screenshot capture, so the CLI's own number was lower.

Queries per request for a 45 snapshot PR build, counted locally with a Drizzle logger on PGlite, before and after 86e06f0:

| Request | Before | After |
| --- | --- | --- |
| `POST /builds` | 157 | 45 |
| `POST /builds/:id/shards/1/complete` | 487 | 66 |

Server time for the playground build in #73, from the request log: `POST /builds` 259 ms, `upload-urls` 49 ms, `shards/1/complete` 270 ms, `GET /builds/:id` about 35 ms. That is about 0.6 s of the 2.3 s upload.

21 uploads in runs on 4d77a17 and e56833c: median 1.9 s, fastest 1.0 s, slowest 33.7 s. The landing page uses these numbers.
