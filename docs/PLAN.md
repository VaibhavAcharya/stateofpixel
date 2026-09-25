# stateofpixel: plan

Pages, tables, API and flows in detail are in [SPEC.md](./SPEC.md), and progress is in [ROADMAP.md](./ROADMAP.md). Sources are linked inline. Items marked (unverified) came from secondhand sources or memory and need a check before we depend on them.

## Why we are building it

Chromatic is good but expensive, and the bill grows in ways teams do not expect. Snapshot count is stories x modes x browsers, and every rebase re-runs everything. ComplyAdvantage went from 133k to 365k snapshots a month in three months and cut costs by making Chromatic a manual step and deleting stories ([post](https://technology.complyadvantage.com/how-we-cut-our-chromatic-costs-by-60-a-visual-testing-optimisation-story/)). Chromatic's fix for cost is TurboSnap, and TurboSnap has a history of bailing out to full rebuilds ([#1014](https://github.com/chromaui/chromatic-cli/issues/1014), [#862](https://github.com/chromaui/chromatic-cli/issues/862), [#437](https://github.com/chromaui/chromatic-cli/issues/437)).

Chromatic is expensive because it renders in its own browser fleet. If the user renders in their own CI, the service only has to store PNGs, remember which one is the baseline, show a review page, and set a GitHub check. That is cheap to run, so it can be almost free.

## Principles

1. The user's CI renders. We never run a browser.
2. The user's CI diffs. The server stores and serves bytes, it does not decode images.
3. Content addressed. A screenshot is its SHA-256. Unchanged screenshots cost one hash in a JSON body, not an upload.
4. Pay for storage, not for volume. A very generous free tier, then storage is the only thing we bill.
5. One CLI, one GitHub App, one review page. Every extra concept has to justify itself.
6. Predictable. No surprise bills. At a limit we warn and soft-fail, we do not block CI.
7. Fast. A build with nothing changed finishes in the time of one HTTP round trip.

## Non-goals for v1

- Cloud rendering, cross-browser farms, iOS Safari.
- TurboSnap-style dependency graphs. The user decides what to render, and hash dedupe makes re-uploading unchanged work free anyway.
- AI or perceptual diffing, accessibility tests, Figma sync.
- GitLab and Bitbucket. GitHub only.
- Open-sourcing any part. The CLI and the server stay closed source for now. The CLI ships to npm unminified with source maps, under a short license that allows free use with stateofpixel, and the docs list every request it sends.

## Landscape

| Tool | Who renders | Price | Notes |
|---|---|---|---|
| Chromatic | Their cloud | Free 5k/mo, Starter $179 for 35k, $0.008 overage ([pricing](https://www.chromatic.com/pricing)) | TurboSnap, modes, UI Review, a11y |
| Argos | Your CI | Free 5k/mo, Pro $100 for 35k, $0.004 overage ([pricing](https://argos-ci.com/pricing)) | MIT, closest to what we want; hash dedupe, odiff, commit statuses |
| Lost Pixel | Your CI | Free 7k, $100 for 40k ([pricing](https://www.lost-pixel.com/pricing)) | OSS mode has no review UI; repo quiet since 2026-04 |
| Vizzly | Your CI | Per seat, no per-screenshot fee ([pricing](https://vizzly.dev/pricing/)) | Newer; shows storage/seat pricing can sell |
| Happo | Their cloud | Free 5k, $149 for 50k ([pricing](https://happo.io/pricing)) | Multi-browser |
| Percy, Applitools | Their cloud | Percy free 5k; Applitools from $667/mo | Enterprise |
| Visual Regression Tracker | Your CI, self-hosted | Free | Apache-2.0, dated UI |
| reg-suit, BackstopJS, Playwright `toHaveScreenshot` | Your CI, no service | Free | No review UI or approval flow |

Argos is the real competitor. It already does BYO CI and hash dedupe. The gaps we can win on:

- Nobody bills only for storage. Argos and Lost Pixel charge per screenshot uploaded.
- Argos blocks uploads at the plan limit. We soft-fail.
- Argos diffs on the server. We diff in CI, so our server cost is close to zero and the price can follow.
- Simpler baseline rules explained on one page, plus carry-over of approvals across rebases by hash.

## How it works

```
 user's CI                                  stateofpixel (Convex)
 ---------                                  ---------------------
 render screenshots (Playwright/Storybook)
 hash every PNG (sha256)
 POST /builds {commit, base, branch, pr,
               snapshots:[{name, sha256}]} -->  resolve baseline build
                                                compare hashes per name
                           <-- per name: unchanged | changed | added
                               baseline URL, upload URL for unknown hashes
 POST new PNGs to upload URLs  -------------->  Convex File Storage
 GET baselines for changed names  <----------   (sha256 computed on upload)
 diff locally (odiff, pixelmatch fallback)
 pixel-identical? mark unchanged
 POST diff PNGs to upload URLs  ------------->  Convex File Storage
 POST /builds/:id/shards/:i/complete ------->  save results, find removed,
                                                carry over approvals,
                                                set GitHub check:
                                                  success if no changes
                                                  action_required if changes
                                                  (link to review page)
```

Reviewer opens the link, approves or rejects, and the server flips the check. Image bytes go straight from CI to Convex File Storage through upload URLs, so no function handles them ([docs](https://docs.convex.dev/file-storage/upload-files)). Convex computes a SHA-256 for every stored file ([docs](https://docs.convex.dev/file-storage/file-metadata)), so the server can check the client's claimed hash without decoding anything.

## Flows

### Onboarding

1. Sign in with GitHub on the web app.
2. Install the GitHub App on a repo. That creates the project.
3. Add one step to CI. On GitHub Actions, auth is OIDC, so no secret to copy. Elsewhere, copy a project token.

```yaml
permissions:
  id-token: write
steps:
  - run: npx playwright test
  - run: npx stateofpixel upload ./screenshots
```

### CI build

As in the diagram above. Details that matter:

- On GitHub `pull_request` events, `GITHUB_SHA` is a synthetic merge commit. Read `pull_request.head.sha` and `base.sha` from `$GITHUB_EVENT_PATH`.
- File SHA-256 is the storage key. If two files differ in bytes but not pixels (PNG metadata, zlib settings), the 0-threshold local diff catches it and the snapshot counts as unchanged.
- Snapshot identity is `name + browser + viewport`. Keep baselines per `os+browser` so a macOS run never compares to a Linux baseline.

### Sharded CI

Each shard uploads with the same nonce (`STATEOFPIXEL_NONCE`, default to the CI run id and attempt) and a shard index. The build completes either when `total` shards arrive or when `stateofpixel finalize` runs. Same model as Argos ([docs](https://argos-ci.com/docs/learn/how-to-guides/ci-pipelines/parallel-testing-sharding.md)).

### Review

One page per build. Lists changed, new and removed snapshots, unchanged hidden by default. Views: side by side, overlay slider, diff highlight. Actions: approve all, approve one, reject one. Any rejection keeps the check failing. Keyboard first (j/k to move, a to approve).

### Merge

A build on the default branch is auto-approved and becomes the baseline. For squash and rebase merges, the main build may run before anything links it to the PR. Use `GET /repos/{o}/{r}/commits/{sha}/pulls` ([docs](https://docs.github.com/en/rest/commits/commits)) to find the PR and treat its last approved build as the source of approvals, the same rule Chromatic documents ([docs](https://www.chromatic.com/docs/branching-and-baselines/)).

### Approval carry-over

If a snapshot in a new build has the same hash as one already approved on this PR, it is approved. Rebasing a PR with approved changes produces zero review work. This falls out of content addressing for free.

## Baseline selection

Adapted from Argos ([docs](https://argos-ci.com/docs/learn/platform-fundamentals/baseline-build.md)), with fewer rules.

1. Baseline branch is the PR base branch, or the default branch for pushes.
2. The client computes `merge-base(head, baseline branch)` and sends it with up to 100 ancestor SHAs (`git rev-list`). If the checkout is shallow, the server uses the GitHub compare API instead.
3. Pick the newest build that is finalized, approved, same build name, and whose commit is in that ancestor list.
4. Per snapshot name, the baseline is that build's image. Missing name means new.

Override the baseline branch with `--baseline-branch <branch>`.

## Diff engine

Client side, two engines ([odiff](https://github.com/dmtrKovalenko/odiff), [pixelmatch](https://github.com/mapbox/pixelmatch)):

- odiff-bin 4.5.0 by default. Zig with SIMD, prebuilt binaries for linux/darwin/win32 x64 and arm64, anti-aliasing detection, ignore regions, and a server mode that avoids a process spawn per image.
- pixelmatch 7.2.0 as fallback. Pure JS, 21 KB, what Playwright uses. On one 1280x720 pair: 25 ms decode, 10 ms diff, 31 ms diff encode (one local run).

Default threshold 0.1 with anti-aliasing ignored, configurable per project. Skip dssim, it is AGPL. Skip resemble.js, it needs the native `canvas` module.

Trusting the client's diff is fine. The user owns the CI; lying to us only fools themselves.

## Flakiness

This is the user's problem technically, and our problem in practice, because they will blame the tool. Ship defaults that make it rare:

- Docs and a template that run capture inside `mcr.microsoft.com/playwright:v<version>-noble`, pinned to the `@playwright/test` version (tag format unverified).
- Playwright helpers default to `animations: "disabled"`, `caret: "hide"`, frozen clock via `page.clock`, local fonts ([docs](https://playwright.dev/docs/api/class-pageassertions)).
- Ignore regions and masks passed through to odiff.
- Later: flag snapshots whose hash flips back and forth across builds of the same commit as flaky.

## Integrations for v1

- Playwright: a reporter that collects screenshots from tests, plus a `snapshot(page, name)` helper.
- Storybook: `stateofpixel storybook ./storybook-static` builds the list from `index.json` and captures each story with Playwright in the user's CI, at every width in `--viewports`.
- Anything else: `stateofpixel upload <dir>`, where file path is the name. This covers Cypress, BackstopJS output, native app screenshots.

## Stack

One pnpm monorepo:

```
stateofpixel/
  apps/web/              TanStack Start app, deployed on Netlify
  packages/backend/      convex/ folder: schema, queries, mutations,
                         http.ts (CI API, GitHub webhooks), crons.ts
  packages/cli/          `stateofpixel` npm package, closed source
  examples/playground/   small pages and stories we break on purpose
                         for dogfooding test PRs
  scripts/test-pr.sh     opens the dogfooding test PRs
  .github/workflows/     ci.yml (lint, types, tests), visual.yml (dogfood),
                         release.yml (CLI releases)
```

- Web app: TanStack Start (`@tanstack/react-start`, docs still say Release Candidate, [docs](https://tanstack.com/start/latest/docs/framework/react/overview)) on Netlify with `@netlify/vite-plugin-tanstack-start` ([docs](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/)). Convex data through `@convex-dev/react-query` ([docs](https://docs.convex.dev/client/tanstack/tanstack-start/)). Public pages render on the server. Signed-in pages render on the client, because Convex Auth has no TanStack Start SSR support yet.
- Backend: Convex for database, file storage, scheduled functions and crons. The CI API and GitHub webhooks are Convex HTTP actions ([docs](https://docs.convex.dev/functions/http-actions)). Live queries mean the build page updates by itself while shards arrive, with no polling.
- Auth: Convex Auth with the GitHub provider ([docs](https://labs.convex.dev/auth/config/oauth/github)). It is beta and may change in backward-incompatible ways ([docs](https://docs.convex.dev/auth/convex-auth)), so pin the version.
- CI auth: GitHub Actions OIDC tokens verified with `jose` inside the HTTP actions (tested from `visual.yml`), or a hashed project token.
- Image storage: Convex File Storage now, Cloudflare R2 later. All storage calls go through one module (`packages/backend/convex/blobs.ts`) with four functions: create upload targets, confirm an upload, get a URL, delete. Each image row records which store holds it, so moving to R2 (through the `@convex-dev/r2` component) can happen image by image.
- CLI: Node 20+, published to npm, odiff-bin as optional dependency, pixelmatch as fallback.
- GitHub App with `checks: write`, `pull_requests: write`, `contents: read`, `actions: read`.
- Deploys: production builds on Netlify run `convex deploy` with a production deploy key, then build the web app ([docs](https://docs.convex.dev/production/hosting/netlify)). Deploy previews and branch deploys build only the web app, against the production Convex URL.
- Rate limits: the `@convex-dev/rate-limiter` component, for requests per token, builds per account and bytes uploaded per account.
- Analytics: Umami Cloud on the web app, cookieless. A before-send hook replaces account, repo, build and snapshot names in URLs with placeholders.
- Tests: Vitest for the CLI, `convex-test` for backend functions, Playwright captures of the web app through our own reporter.

Convex limits shape the backend code ([limits](https://docs.convex.dev/production/state/limits)). A query or mutation has 1 s, 4,096 index ranges, 32,000 documents scanned and 16,000 written. HTTP action bodies are capped at 20 MiB. So every bulk path works in chunks of about 1,000 snapshots: the HTTP action takes the full manifest, then runs internal queries and mutations per chunk.

## Dogfooding

stateofpixel tests itself from the first milestone that has a server.

- `visual.yml` runs on every PR in this repo. It builds the CLI from the workspace, not from npm, so every PR also tests the CLI it changes.
- It uploads three builds: `playground` (static pages in `examples/playground`), `storybook` (the playground stories) and `web` (the public pages and fixture build pages, through the Playwright reporter).
- It uploads to the production stateofpixel instance, as a project for this repo. A PR that changes the backend is tested by the old production backend. That forces the CI API to stay backward compatible, which the CLI needs anyway since users upgrade on their own schedule.
- Test PRs: `scripts/test-pr.sh <scenario>` creates a branch that changes the playground in a known way, pushes it and opens a draft PR. Scenarios today: `no-change`, `color-change`, `layout-shift`, `add-page`, `remove-page`, `add-story`, `remove-story`. Planned: `flaky` (an animation left on), `many-changes`, `sharded`. Each one has an expected check result, so a quick look at the PR list shows whether the service behaves.
- Scenarios for merges (squash, rebase, merge commit) run against a separate test repo, so they do not pollute this repo's history.

## Cost model

Workload: 500 stories x 3 viewports = 1,500 images per build, about 100 KB each (a guess; measured synthetic pages were 5 to 28 KB). 200 main builds a month changing 2%, 440 PR builds changing 5%, PR images pruned after 30 days.

Convex prices, Starter plan pay-as-you-go ([pricing](https://www.convex.dev/pricing)): file storage 1 GB included then $0.033/GB, data egress 1 GB included then $0.132/GB, database storage 0.5 GB then $0.22/GB, function calls 1M then $2.20 per 1M. Pro is $25 per developer per month with 100 GB file storage and 50 GB egress included. Usage is summed across the whole team, so all customers share one allowance.

- File storage: under 12 GB after a year, about $0.36/month.
- Egress: each PR review loads baseline, new and diff images for changed snapshots, about 22 MB for 75 changes. With 1.5 views per PR build plus the CLI downloading baselines, about 18 GB/month, about $2.30/month.
- Database: every build stores one row per snapshot at first. A daily cron deletes unchanged rows of closed PRs, and of main builds outside the newest 20 per build name and older than 90 days. Changed rows stay for history. That keeps snapshot rows bounded at roughly 90 days of main builds plus open PRs.
- Function calls: a few thousand per build, well under 1M/month.
- Chromatic for the same workload is 640 builds x 1,500 = 960k snapshots/month.

So a mid-size team costs about $3 a month on Convex, and most of it is egress. With R2 the same team costs cents. That is fine while we have few users. Egress is the number to watch; move bytes to R2 when egress becomes the biggest line on the Convex bill.

Pricing: a free tier of 10 GB stored per account, then pay only for storage. No per-snapshot, per-build or per-seat fees, so the whole team can review. Storage is the only cost that grows for us, so it is the only thing we bill. PR-only images are kept 60 days by default. Paid plans are storage tiers: 25 GB for $15 a month, 100 GB for $100 and 500 GB for $500, billed monthly or yearly, with yearly 10% cheaper. Above 500 GB, customers contact us. Paid plans show as coming soon until billing ships. Over the limit we warn and soft-fail, we do not block CI.

Storage-only billing means retention is a product feature. Show each project its stored GB, and let users set how long PR-only images are kept.

## Risks

- Argos already does most of this and is MIT. Our edge is price and simplicity, so both have to stay true as features arrive. With closed source, price has to carry that edge until we open it.
- A closed CLI running in CI with an OIDC token adds friction with security reviews at larger companies. Readable npm code, source maps and documented requests reduce it.
- Flaky renders make any visual tool look broken. The Docker and Playwright defaults matter as much as the server.
- GitHub App permissions scare some orgs. Keep the permission list minimal and documented.
- Convex egress is $0.12 to $0.13/GB, and review pages are mostly image downloads. Keep the storage module small so the move to R2 stays a contained change.
- Convex File Storage `getUrl` returns a signed URL (Convex guidelines in `packages/backend/convex/_generated/ai/guidelines.md`). Anyone holding it can open a private repo's screenshot, and how long it stays valid is not documented there (unverified).
- Convex Auth is beta and has no TanStack Start SSR adapter. Signed-in pages render on the client for now.
- TanStack Start docs still call it a Release Candidate.
- The Convex free plan returns errors when over limits. Run production on Starter with a card on file from day one.
- Concurrency on Starter may be 16 queries and 16 mutations at once (unverified). Many CI shards uploading at once could queue. Move to Pro when that shows up.
