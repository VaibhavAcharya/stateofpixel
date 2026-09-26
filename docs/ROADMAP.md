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
- [x] GitHub commit statuses instead of check runs, so the check waits in pending and links straight to the build
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
- [x] Find and speed up slow queries: after an approve moves to the next snapshot, its screenshot sometimes takes 3 to 4 seconds to load

Group 3: lists and viewer
- [x] Polish every list: projects, builds, accounts, sidebar
- [x] Diff overlay toggle in Side by side, on by default
- [x] Sentence case pill labels
- [x] Server-side sort, filter and pagination for projects and builds, on TanStack Table
- [x] Snapshot skeleton that fits the viewer area: while it loads it is taller than the page, so the page scrolls while the sidebar stays fixed
- [x] Viewer as a canvas like Figma: pan and zoom with trackpad, wheel and keys, kept inside the image bounds, with one Fit button to reset; replaces the Fit, 100% and 200% tabs
- [x] Pickable diff overlay color
- [x] Say when retention deleted a build: keep deleted build numbers per project so an old link shows "This build was deleted after 60 days" instead of "Build not found."

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

## Dogfooding

See the README, Dogfooding. `visual.yml` uploads four builds: `playground` (static pages), `storybook` (playground stories), `web` (the public pages and the fixture build pages) and `web-storybook` (the web app stories).

- [x] Playwright suite for the public web pages (landing) through `stateofpixel/playwright`
- [x] A seeded build page that renders without GitHub sign-in, captured in the same suite
- [x] Storybook stories in `examples/playground`, captured with `stateofpixel storybook`
- [x] `scripts/test-pr.sh` scenarios with an expected check result each
- [x] Merge scenarios (squash, rebase, merge commit) against a separate test repo
- [x] More `test-pr.sh` scenarios: `flaky` (an animation left on), `many-changes`, `sharded`
- [ ] The `web` visual job takes 4 to 5 minutes in CI; think about how to handle it
- [x] Storybook stories with fixtures for flows that are hard to reproduce, like checkout results, plan changes, failed renewals, storage warnings and blocked builds

## M3: growth

- [x] Storage billing with Dodo Payments: checkout, customer portal, subscription webhook
- [x] Plan box on the account home, with payment result and failed renewal notices
- [x] Upgrade hints in the account switcher and the storage banner
- [x] Dodo Payments live mode on production: live products, webhook and env vars
- [x] Show when a cancelled subscription ends, from `cancel_at_next_billing_date` and `next_billing_date`
- [x] Account tabs: Projects, Members with roles from GitHub, and Billing with the plan box
- [x] Change between paid plans without cancelling first; `billing.checkout` refuses with `already_subscribed` today
- [x] Disable Upgrade and Manage billing for members who are not owners, and the project Settings tab for users who are not repo admins, each with a tooltip
- [ ] Plan box details from SPEC 5.10: payment method and invoices
- [ ] Usage page
- [ ] PR comment summary
- [ ] Tokenless auth for fork PRs
- [ ] Flaky snapshot detection
- [ ] Move image bytes to R2 when egress cost calls for it

## Free tier and limits

- [x] Free tier of 10 GB stored per account
- [x] Retention crons: PR-only images kept 60 days, unreferenced images deleted
- [x] Storage warning at 80%, 14-day grace at 100%, then new images are not stored
- [x] Rate limits for builds per account, requests per token and bytes uploaded per day
- [x] Enforce the limits in SPEC section 12
- [ ] Per-account egress tracking
- [ ] Landing and FAQ copy for the free tier

## Legal

Needed before applying for a payment gateway.

- [x] Privacy policy page
- [x] Terms and conditions page
- [x] Refund policy page
- [x] Links to all three in the site footer

## Marketing pages

- [ ] Comparison pages against the alternatives
- [x] Docs pages at `/docs`, linked from the header, footer and user menu
- [x] Brand page with the logo, its usage and downloads
- [ ] Open Graph image per page
- [ ] Review the npm keywords of the CLI and the topics of the GitHub repo
- [ ] Images and illustrations in the README instead of the ASCII art
- [ ] Rethink the CLI README that npm shows

## Later

- [ ] Open-source the CLI and the server
