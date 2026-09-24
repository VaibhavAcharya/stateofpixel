# Roadmap

Progress tracker for [PLAN.md](./PLAN.md). Details for each item are in [SPEC.md](./SPEC.md). Check an item off when it is merged to `main`.

## Setup

- [x] pnpm monorepo with `apps/web`, `packages/backend`, `packages/cli`
- [x] Biome, TypeScript, Vitest, GitHub Actions CI
- [x] Convex project linked
- [x] Netlify deploy at https://stateofpixel.netlify.app
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
- [ ] GitHub check runs
- [ ] Pages: account home, project builds list, build review page
- [ ] Review actions and keyboard shortcuts
- [ ] Auto-approve on the default branch
- [ ] Dogfooding: `visual.yml` and first test PR scenarios

## M2: real-world CI

- [ ] Sharding and `stateofpixel finalize`
- [ ] Squash and rebase merge handling
- [ ] Approval carry-over
- [ ] `stateofpixel storybook` capture command
- [ ] Playwright reporter and `snapshot()` helper
- [ ] Retention crons and image cleanup
- [ ] Baselines tab and snapshot history
- [ ] Project settings page

## M3: growth

- [ ] Usage page and storage billing
- [ ] Storage limit warnings and grace period
- [ ] PR comment summary
- [ ] Tokenless auth for fork PRs
- [ ] Flaky snapshot detection
- [ ] Move image bytes to R2 when egress cost calls for it

## Later

- [ ] Open-source the CLI and the server
