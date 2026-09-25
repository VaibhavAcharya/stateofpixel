# Roadmap

Progress tracker for [PLAN.md](./PLAN.md). Details for each item are in [SPEC.md](./SPEC.md). Check an item off when it is merged to `main`.

## Setup

- [x] pnpm monorepo with `apps/web`, `packages/backend`, `packages/cli`
- [x] Biome, TypeScript, Vitest, GitHub Actions CI
- [x] Convex project linked
- [x] Netlify deploy at https://stateofpixel.com
- [x] Design system in `docs/DESIGN.md`

## M0: local compare

- [x] `stateofpixel compare <dir> <baseline-dir>` with odiff, pixelmatch fallback
- [x] Hashing and 0-threshold pixel check for byte-different, pixel-identical PNGs
- [x] Snapshot naming from folder paths
- [x] HTML report with side by side, diff, slider and flip views
- [x] Unit tests with fixture PNGs

## M1: the service

- [x] Convex schema (SPEC section 6)
- [x] GitHub App: sign-in with Convex Auth, install flow, webhooks
- [x] CI auth: GitHub Actions OIDC and project tokens
- [x] `POST /builds`, shard complete, finalize (SPEC section 7)
- [x] Uploads to Convex File Storage through `blobs.ts`
- [x] Baseline selection
- [x] `stateofpixel upload <dir>`
- [x] GitHub check runs
- [x] Pages: account home, project builds list, build review page
- [x] Review actions and keyboard shortcuts
- [x] Auto-approve on the default branch
- [x] Dogfooding: `visual.yml` and first test PR scenarios

## Web polish

Group 1: auth and navigation
- [x] Sign-in button shows progress while redirecting to GitHub and while the code exchange runs
- [x] Sign out lands on `/`
- [x] "All projects" entry in the account switcher, and `/install` as the signed-in home in the breadcrumb
- [x] Keyboard shortcuts button as an icon in the app header

Group 2: speed
- [x] Measure where page and navigation time goes
- [x] Keep query results across navigation, prefetch neighbours, render cached permissions while they refresh
- [x] Optimistic updates for build counts, conclusion and Approve all
- [x] One round trip for project access and the page data on first visit

Group 3: lists and viewer
- [x] Polish every list: projects, builds, accounts, sidebar
- [x] Diff overlay toggle in Side by side, on by default
- [x] Sentence case pill labels
- [x] Server-side sort, filter and pagination for projects and builds, on TanStack Table

Group 4: landing
- [x] Drop Playfair Display, one sans and one mono only
- [x] More sections, built to convert
- [x] Logo as the favicon

## M2: real-world CI

- [x] Sharding and `stateofpixel finalize`
- [x] Squash and rebase merge handling
- [x] Approval carry-over
- [x] `stateofpixel storybook` capture command
- [x] Playwright reporter and `snapshot()` helper
- [x] Baselines tab and snapshot history
- [x] Project settings page

## M3: growth

- [ ] Usage page and storage billing
- [ ] PR comment summary
- [ ] Tokenless auth for fork PRs
- [ ] Flaky snapshot detection
- [ ] Move image bytes to R2 when egress cost calls for it

## Free tier and limits

- [ ] Free tier of 10 GB stored per account
- [ ] Retention crons: PR-only images kept 60 days, unreferenced images deleted
- [ ] Storage warning at 80%, 14-day grace at 100%, then new images are not stored
- [ ] Rate limits for builds per account, requests per token and bytes uploaded per day
- [ ] Enforce the limits in SPEC section 12
- [ ] Per-account egress tracking
- [ ] Landing and FAQ copy for the free tier

## Marketing pages

- [ ] Comparison pages against the alternatives
- [ ] Brand section with the logo and its usage
- [ ] Open Graph image per page

## Later

- [ ] Open-source the CLI and the server
