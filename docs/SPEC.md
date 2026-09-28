# stateofpixel: product spec

Companion to [PLAN.md](./PLAN.md). PLAN.md says why; this file says exactly what: pages, tables, API, CLI, states and flows. Items marked (proposal) are defaults that are not final. Items marked (unverified) need a check against GitHub or Convex docs before we build on them.

Stack: pnpm monorepo, TanStack Start on Netlify, Convex for database, auth (Convex Auth) and file storage. See the [README](../README.md) for the repo layout and dogfooding.

## Contents

1. Concepts
2. Access model
3. States
4. UX flows
5. Pages
6. Convex tables
7. CI API
8. App functions
9. GitHub integration
10. CLI
11. Storage and retention
12. Limits
13. Not in v1

## 1. Concepts

| Concept | Meaning |
|---|---|
| Account | A GitHub user or org that installed the GitHub App. Billing and storage usage live here. |
| Project | One GitHub repository. Created when the app gets access to the repo. |
| Build | One visual test run for one commit and one build name. A PR push creates one build per build name. |
| Build name | Lets one repo run separate suites, like `storybook` and `e2e`. Default is `default`. Each build name has its own baselines and its own GitHub check. The web app calls it "Suite". |
| Shard | One CI job uploading part of a build. A build has 1 or more shards. |
| Snapshot | One named screenshot inside a build. |
| Snapshot name | Unique inside a build. The client puts the mode in the name, for example `Button/Primary [chromium 1280]`. Same name across builds means same snapshot. |
| Image | A PNG stored once, keyed by its SHA-256. Snapshots and diffs point to images. |
| Baseline build | The approved build a new build is compared against. |
| Review | A person approving or rejecting snapshots in a build. |

Snapshot identity is only the name. Metadata (browser, viewport, OS, test file) is stored for display and filtering and never changes matching. This keeps the rule easy to explain: rename the snapshot and it is a new snapshot.

## 2. Access model

Access comes from GitHub. stateofpixel has no invites or roles of its own; the Members tab (5.9) lists the people who signed in and links to GitHub to add or remove them.

| GitHub permission on the repo | Can do |
|---|---|
| none, private repo | nothing, 404 |
| none, public repo | view builds and baselines, once signed in |
| read | view builds and baselines |
| write, maintain | also review (approve, reject) |
| admin | also change project settings and tokens |
| account owner | also change the plan and billing |

The server asks GitHub for the user's permission on the repo with the user's token and caches the answer for 5 minutes (section 8 has the pattern). Removing someone from the repo on GitHub removes their access here within 5 minutes, and to private image links within 2 hours (section 11, Private images). Org owner comes from `GET /user/memberships/orgs/{org}` with the same token. The owner of a user account is that user. The account pages ask GitHub once per page load and save the answer as `role` on the user's `accountMembers` row, so the Members tab can show roles and the Billing tab can disable its buttons for members. The billing actions still ask GitHub on every call.

Controls a user cannot use stay visible and are disabled, with a tooltip that says who can use them: the project Settings tab for users who are not repo admins, and Upgrade and Manage billing for account members who are not owners.

## 3. States

### Build status

```
             create (first shard)
                    |
                    v
               +---------+   all shards done, or finalize call
               | pending | ------------------------------------+
               +---------+                                     |
                 |     |                                        v
   no finalize   |     | client reports error           +-----------+
   in 60 min     |     +------------------+             | finalized |
                 v                        v             +-----------+
            +---------+              +-------+
            | expired |              | error |
            +---------+              +-------+
```

### Build conclusion (only when finalized)

| Conclusion | When |
|---|---|
| `no_changes` | Every snapshot is `unchanged`, or only `removed` ones exist. |
| `changes` | At least one `changed` or `added` snapshot is not reviewed yet, or one is `failed`, and none is rejected. |
| `approved` | Every `changed` and `added` snapshot is approved and none is `failed`. Also set automatically on auto-approve branches and on orphan builds. |
| `rejected` | At least one snapshot is rejected. |

The conclusion is recomputed after every review action and after approval carry-over.

A build is `superseded` when a newer finalized build exists for the same PR and build name. Superseded is a flag, not a status. Its review buttons are disabled and a banner links to the newest build.

An orphan build is one with no baseline build, usually the first build of a project. It is auto-approved so it becomes the first baseline.

### Snapshot diff status

| Diff status | When |
|---|---|
| `unchanged` | Same hash as baseline, or different bytes but 0 pixels differ above threshold. |
| `changed` | Pixels differ above the threshold, or dimensions differ. |
| `added` | No snapshot with this name in the baseline build. |
| `removed` | Baseline has the name, this build does not. Only computed for full builds (see subset builds in the CLI section). |
| `failed` | Upload or diff failed in the client. Counts as not passing. |

### Snapshot review state

| Review state | When |
|---|---|
| `none` | `unchanged` and `removed` snapshots. They never need review. |
| `pending` | `changed` or `added`, nobody acted yet. |
| `approved` | Approved by a reviewer, by carry-over, or by auto-approve. |
| `rejected` | Rejected by a reviewer. |

Removed snapshots do not block (proposal). Deleting a story is intentional in almost every case, and the build page still lists them.

### GitHub check mapping

The check is a GitHub commit status. GitHub links a status straight to its `target_url`, while the Details link of an app's check run opens GitHub's own checks page. A completed check run also has no waiting state, and GitHub shows `action_required` as failing.

`toStatus` in `convex/lib/checkStatus.ts` maps a build to its state and description, and [/docs/checks](https://stateofpixel.com/docs/checks) renders its table from the same function. Waiting shards and changes to review are `pending`, rejected changes are `failure`, expired builds and failed uploads are `error`, and everything else, including the storage limit, is `success`. `target_url` is always the build page. The storage limit reports `success` because statuses have no neutral state and CI never fails because of us.

## 4. UX flows

### 4.1 Sign up and first project

1. User opens the landing page and clicks "Sign in with GitHub".
2. Convex Auth runs GitHub OAuth with the GitHub App's client credentials. We save the user's id, login, avatar and token, then call `me.refreshAccounts` to find their installations.
3. If the user has no installation, show the Install page with one button: "Install on GitHub". It goes to the GitHub App install screen where they pick an account and repos.
4. GitHub redirects back with `installation_id`. We already got the `installation` webhook, so accounts and projects exist. If the webhook has not arrived yet, the page waits on a live query and updates as soon as it lands.
5. User lands on the Account page with the new projects listed. Each project with no builds shows the Setup card.

### 4.2 Setup card (project with no builds)

The project page shows three steps, copy buttons for each, and live state:

1. "Add the permission" with the `permissions: id-token: write` snippet.
2. "Add the step" with a snippet picked by a tab: Playwright, Storybook, Folder.
3. "Push a commit". Shows "Waiting for your first build..." and updates the moment the first build arrives, through a live query.

For CI other than GitHub Actions, a link opens the Tokens section of settings.

### 4.3 First build (orphan)

1. CI runs `stateofpixel upload`. There is no baseline, so every snapshot is `added` and every image is uploaded.
2. Build is auto-approved because it is an orphan. Check: success, "Baseline created, 1,500 snapshots".
3. The project page replaces the Setup card with the builds list.

### 4.4 PR with changes, happy path

1. Developer pushes a branch and opens a PR.
2. CI uploads. 1,488 unchanged, 10 changed, 2 added. Only 12 images are uploaded, plus 10 diff images.
3. Check: pending, "12 changes to review", with a "Details" link.
4. Reviewer clicks Details and lands on the build page with the first changed snapshot open.
5. Reviewer steps through with `j` and `k`, approves with `a`. Or clicks "Approve all".
6. When the last pending snapshot is approved, conclusion becomes `approved` and the check flips to success. The page shows a toast "Build approved, check updated on GitHub".
7. PR merges.

### 4.5 PR with a rejected change

1. Reviewer presses `r` on a snapshot. A small optional comment box opens (single line, stored on the review, shown on the build page).
2. Conclusion becomes `rejected`, check shows failure, "1 change rejected".
3. Developer fixes the code and pushes. The new build compares against the same baseline. If the fix restores the old pixels, the snapshot is `unchanged` and needs nothing.
4. The old build is superseded.

### 4.6 New push on a PR with approved changes (carry-over)

1. Developer rebases or pushes an unrelated fix.
2. New build. As each shard's snapshots are inserted, the server looks up every pending `changed` or `added` snapshot in `approvedImages` for the same PR and build name. If that image was approved in an earlier build, the snapshot is approved by carry-over, with a `reviews` row of source `carry_over` that points at the original approval.
3. If all changes carry over, conclusion is `approved` right at finalize and the check is green without anyone opening the page.
4. On the build page, carried-over snapshots show "Approved in build #41 by @alice".

Rejections do not carry over. A rejected image showing up again is shown as pending with a note "rejected in build #41", so the reviewer sees it but a stale rejection does not block forever. Undoing or rejecting a carried-over approval removes every approval of that image on the PR, so the next push does not carry it over again.

### 4.7 Merge to the default branch

1. Merge creates a push on `main`. CI runs `stateofpixel upload`.
2. `main` matches the auto-approve pattern, so the build is approved and becomes the newest baseline. A build is auto-approved when it has no PR number and its branch matches one of `autoApproveBranches` (`*` matches within one path segment, `**` across segments). Its changed and added snapshots are inserted as approved with a `reviews` row of source `auto_branch`.
3. For squash and rebase merges, the new commit is not a descendant of the PR head. When a new build has no PR number, `POST /builds` calls `GET /repos/{o}/{r}/commits/{sha}/pulls` and stores the number of a merged PR whose base is the build's branch as `mergedPrNumber`. The build page shows "From PR #123" and links the PR's last build. A GitHub error skips the lookup and never fails the build.

Auto-approve on main means anything that lands on main is the truth. If a change was not reviewed on the PR (check not required), it still becomes the baseline. The build page for that main build marks a changed or added snapshot "not reviewed on PR" when its image has no `approvedImages` row for the merged PR.

### 4.8 Sharded CI

1. Four jobs run `stateofpixel upload --shard 1/4` through `4/4`. The nonce defaults to `GITHUB_RUN_ID` plus `GITHUB_RUN_ATTEMPT`.
2. The first shard creates the build; the rest join it by nonce.
3. Check shows "Waiting for screenshots (2 of 4 shards)".
4. When the 4th shard completes, the server computes `removed`, the conclusion and carry-over, then updates the check.
5. If the shard count is unknown, jobs use `--shard auto` and a final job runs `stateofpixel finalize`.

A re-run of a failed CI job gets a new `GITHUB_RUN_ATTEMPT`, so it creates a fresh build and never mixes with the half-finished one.

### 4.9 Flaky snapshot

1. A snapshot shows 3 pixels different, caused by anti-aliasing noise.
2. Reviewer approves it. Next build it might flip back, and it would need review again.
3. The snapshot detail panel shows its history. A changed snapshot shows "Looks flaky: flipped 3 times in 10 builds" and a link to the stable screenshots docs when, in its image and the images of the last 9 earlier builds of the suite on the baseline branch, the image changes at least 2 times and at least once goes back to an earlier image. It shows "Looks flaky: build #410 of the same commit has a different image" instead when another finalized build of the suite on the same commit has a different image. Computed in `snapshots.get` from `findFlaky` in `lib/history.ts`; nothing is stored and the check does not change.
4. Fix is in the user's config: raise the threshold for that snapshot, or mask the region.

### 4.10 Storage limit reached

1. Account reaches 80% of its storage limit. Account pages, and project pages for users with write access, show a yellow banner. The CLI prints a warning line.
2. At 100%, a 14-day grace period starts and `overLimitSince` is set. Everything keeps working, banner turns red and names the date grace ends.
3. After grace, new builds get `storageBlocked`. They still hash-compare, but `POST /builds` returns no upload URLs for new hashes and no baseline URLs, so the CLI neither uploads nor diffs. Snapshots that match the baseline are `unchanged` as usual. Changed and added snapshots get a row with no image and review state `none`. The build finalizes as `changes`, is never a baseline, cannot be reviewed, and the check passes with "Storage limit reached, not compared". CI never fails because of us.
4. Freeing space (shorter retention, deleting projects) or upgrading ends the state as soon as `storageBytes` drops under the limit. Upgrading goes through Dodo Payments (section 8, Billing). `accounts.setPlan` (an internal mutation run from the Convex dashboard) still sets a plan by hand, for example `custom`.

### 4.11 Removing access

- Repo removed from the installation: project gets `archivedAt`. It is hidden from lists and pages, CI auth rejects it, no commit status is set and images are not served. Builds, tokens and images stay and count toward storage; retention still runs. Adding the repo again clears `archivedAt`. Nothing deletes archived projects; data is deleted on request.
- App uninstalled or suspended: same for all projects of the account. The subscription is not cancelled.
- Project deleted from settings: confirm by typing the repo name, delete right away, images are removed by the next GC run.

### 4.12 CI on a non-GitHub-Actions runner

1. Admin opens Settings, Tokens, "Create token". Token shown once, stored hashed.
2. User sets `STATEOFPIXEL_TOKEN` in their CI.
3. Git info comes from GitHub Actions env vars when set, otherwise local git. If the checkout is shallow and the merge base is not in local history, the server uses the GitHub compare API.

## 5. Pages

URL scheme mirrors GitHub: `/{owner}/{repo}`. Public pages (5.1) are server-rendered by TanStack Start. Signed-in pages render on the client, because Convex Auth has no TanStack Start SSR support; they show a skeleton until auth and the permission check are ready.

### 5.1 Public pages

| Path | Content |
|---|---|
| `/` | Landing. One-sentence pitch, the review demo, setup snippets per runner, upload times from our own CI, team access, a cost comparison, pricing block, FAQ, Sign in button. |
| `/brand` | Logo files to download, usage rules, colors and type. |
| `/compare`, `/compare/{competitor}` | Comparisons with Chromatic, Argos, Percy and Lost Pixel. Each page has a headline of its own, a bill or status card, both pipelines, what changes, the review page, a cost calculator for priced competitors, a grouped table with a numbered source for every competitor fact, where the competitor is ahead, before and after workflow snippets, an FAQ with FAQPage JSON-LD, and the sources. The data and the check date are in `apps/web/src/content/compare.ts`, competitor plans in `apps/web/src/lib/competitorPricing.ts`, logos in `public/logos/compare/`. Linked from the header and footer. |
| `/privacy`, `/terms`, `/refunds` | Legal pages. Support email `hello@stateofpixel.com`. |
| `/docs`, `/docs/{page}` | User docs: Quickstart, Moving from another tool; Playwright, Storybook, Any screenshots; Other CI, Sharding, Suites; Reviewing changes, The GitHub check, Baselines; Stable screenshots, Troubleshooting; Accounts and projects, Billing, Security; CLI, Limits and storage. Linked from the public header and footer and the user menu. The pages are MDX in `apps/web/src/content/docs/`, served by `routes/docs/$slug.tsx`, with the nav in `components/docs/DocsLayout.tsx`. Tables of limits, check states, CLI flags and shortcuts render from the code (`components/docs/generated.tsx`). |
| `/robots.txt`, `/sitemap.xml` | `robots.txt` is static in `apps/web/public` and allows everything. `sitemap.xml` is written at build time by `apps/web/scripts/og-images.ts` from the same page list as the Open Graph images: the public pages, the comparisons and the docs. Each URL has a `<lastmod>` from the last commit that touched its sources, listed by `pageSources` in `scripts/ogImage.ts`; a shallow clone leaves `<lastmod>` out. In dev, a Vite middleware in `vite.config.ts` serves `sitemap.xml` and the Open Graph images from that list on each request. Each of those pages sets a canonical URL on `stateofpixel.com` through `pageLinks` in `src/lib/pageMeta.ts`, so deploy previews do not compete in search. |
| `/llms.txt`, `/llms-full.txt`, `{page}.md` | Written at build time by `apps/web/scripts/llms.ts`, called from `og-images.ts`. `llms.txt` follows [llmstxt.org](https://llmstxt.org): the tagline and summary, the setup steps, promises and starting price from the landing data, then a link to the Markdown version of every public page, grouped like the docs nav, with the legal and brand pages under Optional. Each page has a Markdown copy at its path plus `.md`, and `/index.md` for the landing page. Docs, legal and brand pages are rendered by the built server and converted from their `<article>` or `<main>` to Markdown; the landing and comparison pages are written from their data in `sections.tsx`, `Pricing.tsx` and `content/compare.ts`. `/docs.md` ends with a list of every docs page. Docs pages link their Markdown copy with `<link rel="alternate" type="text/markdown">`, and the docs nav links `llms.txt` and `llms-full.txt`. `llms-full.txt` joins every docs page in nav order. The build fails when a docs page is missing from the nav. In dev, a Vite middleware serves the same files. `netlify.toml` serves `.md` as `text/markdown`. |

Paid plans in the pricing block show "Coming soon" only when `billing.available` returns false; while the query loads, and in the server-rendered page, they show as available. Upgrading happens only from the plan box on the Billing tab (5.10).

These paths shadow GitHub accounts with the same login.

In dev only, `/lab.stateofpixel/web/builds/{1,2}` renders the build page from fixtures for the visual suite (README, Development). GitHub logins cannot contain a dot, so it never shadows an account.

### 5.2 Install (`/install`)

Shown when the signed-in user has no installations. One button to the GitHub App install screen. Below it: "Already installed? Refresh" for when the webhook is slow.

### 5.3 Account home (`/{owner}`)

```
+--------------------------------------------------------------+
| stateofpixel      acme v                         [avatar]    |
+--------------------------------------------------------------+
| acme                                   [Configure on GitHub] |
| Organization                                                 |
| Projects   Members   Billing                                 |
|                                                              |
| web-app        #412  main   no changes     2 min ago         |
| design-system  #88   feat/x 12 to review   1 h ago           |
| marketing      no builds yet                                 |
|                                                              |
| Missing a repo? Configure access on GitHub                   |
+--------------------------------------------------------------+
```

- Tabs: Projects (this page), Members (5.9), Usage (5.11) and Billing (5.10). Usage is for owners only. The header, the account banner and the tabs are the same on all of them.
- Account switcher for users in several orgs. Each account shows its plan in muted text.
- One row per project: name, latest build number, branch, conclusion pill, relative time.
- Account banner, one at a time, most urgent first. The same banner shows on project pages to users with write access.
  1. Storage over the limit, in grace or blocked (4.10). Red.
  2. A failed renewal (`on_hold` or `past_due`): "The last payment for the 25 GB plan failed." Red. The plan stays until Dodo cancels the subscription.
  3. A subscription cancelled at the next billing date, when the account stores more than the Free plan allows or the plan ends within 14 days: "The 25 GB plan ends on Oct 25, 2026, then the account moves to the Free plan with 10 GB of storage." When it stores more, it adds "It stores 18 GB, so from Nov 8, 2026 new images are not stored." Yellow when it stores more, blue otherwise.
  4. Storage from 80% of the limit (4.10). Yellow.
- The storage banners say how to free space and get more. On a project page, admins get a link to the project settings; everyone else reads that repository admins can lower retention. Owners get a link to the Billing tab ("Upgrade the plan", or "Move to a bigger plan" with a subscription, and "Update the payment method"). Members of an org read "Ask an owner of acme to ...", with "an owner" linking to the Members tab, and collaborators on a user account read "Ask octocat to ...". While the role is not known they read "Owners of acme can ...". When billing is not available the banner points to the support email.
- "Configure access on GitHub" links to the installation settings.

### 5.4 Project page (`/{owner}/{repo}`)

Tabs: Builds (default), Baselines, Settings. Settings is disabled for users who are not repo admins, with the tooltip "Only admins of this repository on GitHub can change its settings." It stays a link while the permission is not known yet.

Builds tab:

```
+------------------------------------------------------------------+
| acme / web-app                     Builds  Baselines  Settings   |
+------------------------------------------------------------------+
| Branch [all v]  Status [all v]                                   |
|                                                                  |
|  #   Status          Branch        Commit              PR   Time |
| 412  no changes      main          Fix footer (a1b2c3) -    2m   |
| 411  12 to review    feat/header   New header (d4e5f6) #88  1h   |
| 410  approved        feat/header   WIP (0a1b2c)        #88  3h   |
|      superseded                                                  |
| 409  rejected        fix/btn       Button pad (99aa00) #87  1d   |
|                                         [ Load more ]            |
+------------------------------------------------------------------+
```

- Columns: build number, conclusion pill with counts, branch, commit message (first line) and short SHA, PR number linking to GitHub, build name as the Suite column if the project has more than one, relative time with absolute time on hover.
- Filters are in the URL query so they can be shared. The builds list filters by branch (`?branch=`), pull request (`?pr=`) and states (`?state=`), and sorts with `?order=asc`. There is no build name filter yet.
- 50 rows per page, "Load more" by cursor.
- Pending builds show a spinner and shard progress, updated live.
- Empty project shows the Setup card (4.2) instead.

### 5.5 Build page (`/{owner}/{repo}/builds/{number}`)

The main page of the product. Everything is keyboard driven.

```
+----------------------------------------------------------------------------+
| #411  feat/header  d4e5f6 "New header"  PR #88   vs baseline #405 (main)   |
| 10 changed  2 added  1 removed  1,488 unchanged     [Reject] [Approve all] |
+-------------------------+--------------------------------------------------+
| Filter [          ]     |  Header/Default [chromium 1280]       changed    |
|                         |  0.84% diff, 7,742 px          1280x720          |
| Changed (10)            |  [Side by side] [Diff] [Slider] [Flip]  Fit 100% |
| > Header/Default [1280] | +---------------------+ +---------------------+  |
|   Header/Default [375]  | |                     | |                     |  |
|   Nav/Open [1280]    v  | |      baseline       | |        new          |  |
|   ...                   | |                     | |                     |  |
| Added (2)               | +---------------------+ +---------------------+  |
|   Header/Promo [1280]   |                                                  |
| Removed (1)             |  [Reject  r]                    [Approve  a]    |
|   Header/Old [1280]     |                                                  |
| Unchanged (1,488)  +    |  History: #405 #398 #377   Test: header.spec.ts  |
+-------------------------+--------------------------------------------------+
```

Header:
- Build number, branch, short SHA linking to the GitHub commit, commit message, PR link.
- "vs baseline #405 (main)" links to the baseline build. For orphans: "First build, no baseline".
- Counts per diff status. Clicking one scrolls the list to that group.
- "Approve all" approves every pending snapshot. "Reject" rejects the build as a whole, which rejects every pending snapshot. Both need write permission; for readers the buttons are hidden and a note says "You need write access on GitHub to review".
- Banners: superseded (link to newest), pending (shard progress, auto-refresh), expired, error, storage limit, "From PR #123" on squash-merged main builds.
- A build that retention deleted shows "This build was deleted." with its branch and date from `deletedBuilds`: "Build 42 of feat/header was deleted on Sep 3, 2026, 60 days after pull request #88 closed." or "..., after the branch had no new build for 60 days." A number under `nextBuildNumber` without a row, deleted before `deletedBuilds` existed, says it was deleted by retention. A See builds button links to the project. Any other missing number shows "Build not found."

Sidebar:
- Groups in order: Changed, Added, Removed, Failed, Unchanged. Unchanged is collapsed.
- Each row: name, review icon (pending, approved, rejected, carried over), diff percent for changed.
- Filter box matches name substring. `/` focuses it.
- Sorted by name inside a group.

Viewer:
- Title row: snapshot name, diff status, diff percent and pixel count, dimensions (both if they differ, like `1280x720 to 1280x812`).
- Modes:
  - Side by side: baseline left, new right, zoom and pan synced.
  - Diff: new image with the diff image overlaid in the diff color at 70% opacity.
  - Slider: one frame, a vertical handle wipes between baseline and new.
  - Flip: one frame, space toggles between baseline and new. Best for 1-pixel shifts.
- Canvas: Fit (default) fits the width, never above 100%. Wheel and trackpad scroll pan, drag pans, pinch or ctrl+wheel zooms at the pointer, `+` / `-` zoom at the center, `0` is 100%, `f` or the Fit button resets. Zoom goes from the whole image in view up to 800%. Panning stops at the image edges plus 16px. A wheel that cannot pan scrolls the page. Opening another snapshot resets to Fit. Math in `apps/web/src/lib/canvasView.ts`.
- Diff color: green (default), red, magenta or blue, picked in the toolbar while the diff shows (Side by side with the overlay on, and Diff). Kept in the viewer settings, so it stays across snapshots until reload. The diff PNG is used as a mask: an SVG filter (`feFlood` in the color, `feComposite` `in` `SourceAlpha`) paints each non-transparent pixel in the picked color. A filter needs no CORS on the image, which `mask-image` would.
- Added snapshots show only the new image. Removed snapshots show only the baseline.
- Different dimensions: images align top-left, the empty area is a checkerboard.
- Chosen mode and zoom are remembered in localStorage per user.

Detail footer:
- History: last 10 builds on the baseline branch where this snapshot's hash changed, as links. Ships with snapshot history (M2).
- Looks flaky: the line from section 4.9, above History.
- Metadata: browser, viewport, OS, test file and line, anything else the client sent.
- Review info: "Approved by @alice 3 min ago", "Approved in build #410 by @alice (carried over)", or the reject comment.

URL: selected snapshot is in the path, `/builds/411/snapshots/{snapshot_id}`, so a link opens the same snapshot. The first changed snapshot is selected when there is none in the URL.

Keyboard shortcuts (`?` shows this list as an overlay):

| Key | Action |
|---|---|
| `j` / `k` | Next / previous snapshot |
| `a` | Approve current snapshot, move to next pending |
| `r` | Reject current snapshot (opens comment box) |
| `u` | Undo review on current snapshot |
| `shift+a` | Approve all pending |
| `1` `2` `3` `4` | Side by side, Diff, Slider, Flip |
| `d` | In Side by side, toggle the diff overlay. In Diff, toggle Diff only |
| `space` | In Flip mode, toggle image |
| `f` / `0` | Fit / 100% zoom |
| `+` / `-` | Zoom in / out |
| `/` | Focus filter |
| `?` | Shortcuts overlay |

Review actions are optimistic in the UI and send one request each. If a request fails, the icon reverts and a toast explains.

### 5.6 Baselines tab (`/{owner}/{repo}/baselines`)

Browse what is approved on the default branch now.

- Suite selector (`?suite=`) if there are several build names. The default, All, shows one section per build name.
- Filter by name prefix, like `components/`.
- Grid of snapshots from the newest approved build of each build name on the default branch: image scaled down by the browser, name under it. Lazy loaded, 60 per page.
- Clicking one opens Snapshot history.

### 5.7 Snapshot history (`/{owner}/{repo}/baselines/{snapshot_name}`)

- Timeline of builds on the default branch where this name's image hash changed, newest first. The query scans the newest 100 builds on the branch and returns up to 50 entries.
- Each entry: build number, commit, date, who approved on the PR if known, a thumbnail.
- Clicking two entries compares them in the same viewer as the build page.

### 5.8 Project settings (`/{owner}/{repo}/settings`, admin only)

| Section | Field | Default | Notes |
|---|---|---|---|
| General | Default branch | from GitHub | Read-only mirror, updated by webhook. |
| General | Auto-approve branches | `main` plus the default branch | Glob list, like `main, release/*`. |
| Diff | Threshold | 0.1 | Passed to the CLI in the build response, so config lives in one place. The CLI config overrides it. |
| Diff | Include anti-aliasing | off | |
| Checks | Check name | `stateofpixel` | Other build names: `stateofpixel/{build name}`. |
| Retention | Keep PR-only images for | 60 days | 7 to 365. The Usage tab (5.11) shows the storage of each project's PR-only images; showing it here is not built yet. |
| Tokens | Project tokens | none | Create, name, last used time, revoke. Token shown once. |
| Danger | Delete project | | Type the repo name to confirm. Deletes the project row right away and its builds, snapshots, reviews, approvals and tokens in chunks. A repository still in the installation comes back as an empty project on the next sync. |

Every change is saved on blur with a small "Saved" note. No save button.

### 5.9 Members (`/{owner}/settings/members`)

- A short note: everyone listed signed in to stateofpixel and has access to the account on GitHub, so people are added and removed on GitHub. For an org, a "Manage people on GitHub" button links to `https://github.com/orgs/{org}/people`.
- A table of the account's `accountMembers`, owners first, then by login: avatar, name and login, role, and when they last signed in. Roles are Owner and Member for an org, and Owner and Collaborator for a user account. A member whose role was never checked shows no role.
- There is no invite, remove or role change here.

### 5.10 Billing (`/{owner}/settings/billing`)

- Plan box: plan name, storage used and, for an active subscription, "Renews on Oct 25, 2026" or "Ends on Oct 25, 2026". When billing is available, it shows an Upgrade menu (paid plans, monthly and yearly) while the account has no subscription, a Change plan menu with the same items and the current one marked while the subscription is active and not cancelled, and Manage billing once it has a billing customer. Under the box, a line says that Manage billing opens the Dodo Payments portal to update the card, download invoices and cancel. For members who are not owners the buttons are disabled, with the tooltip "Only owners of acme on GitHub can change the plan and billing." While the role is not known they stay enabled, and the actions check for an owner and the box shows the error.
- Checkout and the customer portal return to `/{owner}/settings/billing`, checkout with `?subscription_id=...&status=...`. The status is a hint from Dodo, never proof of payment, so the plan box only says what happens next: "Payment received. Your plan updates in a few seconds." until the webhook makes that subscription active, then "Payment received. You are on the 25 GB plan."; "Your payment is processing" for `pending`; and for any other status, "The payment did not go through, so your plan did not change." The notice can be dismissed, which removes the query.
- Choosing a plan in Change plan shows a confirm row under the plan box with the amount charged now from `billing.previewPlanChange` and the new renewal date: "Move to the 100 GB plan, billed yearly? You pay $X now. Unused time on your current plan counts toward it, and any left over is credited to later renewals. The new plan renews on Oct 26, 2027." Confirming runs `billing.changePlan`; if Dodo returns a payment link, the page opens it. After that the box says "Plan change received. Your plan updates in a few seconds." until the webhook moves the account, then "Plan changed. You are on the 100 GB plan."
- A failed renewal and a cancelled subscription show in the account banner (5.3), so members see them on every account page and writers on project pages.
- Not built yet (M3): payment method and invoices in the plan box.

### 5.11 Usage (`/{owner}/settings/usage`, owners only)

- A tab between Members and Billing. For members who are not owners it is disabled, with the tooltip "Only owners of acme on GitHub can see usage.", and the page says only owners can see usage.
- Summary box: storage used of the plan limit from `accounts.storageBytes`, a bar split into baselines, PR-only images and diff images, the size of each, and when the split was last counted. Before the first count it says the split shows after it.
- A bar chart of daily storage for the last 90 days from `usageDaily`, with the date and size of each day in its title. Days without a count are empty.
- A table per project, largest first: name (links to its settings; archived projects show "Archived" and no link), storage, share of the counted total, baselines, PR-only images, diff images and the retention setting. Below 768px the three split columns are hidden, and below 640px the retention column.
- The split comes from the latest `usageDaily` day, so it can be up to a day old, while the total is live.

### 5.12 User menu

Avatar menu with: account switcher, theme, Docs, Sign out. No user settings page in v1.

## 6. Convex tables

Defined in `packages/backend/convex/schema.ts`. Index names list every indexed field (`by_a_and_b`), per the Convex guidelines in `packages/backend/convex/_generated/ai/guidelines.md`. Every document gets `_id` and `_creationTime` from Convex, so tables below leave them out. Field names are camelCase. `Id<"x">` is a Convex reference. Deletes do not cascade in Convex, so GC and project deletion delete children in chunks.

Documents are capped at 1 MiB and arrays at 8,192 elements ([limits](https://docs.convex.dev/production/state/limits)). No table stores a per-build list of snapshots inside one document; snapshots are their own table.

### Convex Auth tables

`authTables` from `@convex-dev/auth` provides `users`, `authAccounts`, `authSessions`, `authRefreshTokens` and the rest. We extend `users`:

| Field | Type | Notes |
|---|---|---|
| githubUserId | number | From the GitHub profile. Index `by_githubUserId`. |
| login | string | Updated on each sign-in. |
| name | string, optional | |
| image | string, optional | Avatar URL. |
| githubToken | string | User access token, saved from the provider's `profile(profile, tokens)` callback. Read only by internal functions, never returned to the client. |
| lastSeenAt | number | |

The GitHub provider uses the GitHub App's own client ID and secret, so the user token is a GitHub App user token and can list the user's installations. GitHub App user tokens expire after 8 hours unless expiry is turned off in the app settings (unverified). v1 turns expiry off. If GitHub answers 401, the app signs the user out and asks them to sign in again.

### accounts

| Field | Type | Notes |
|---|---|---|
| githubAccountId | number | User or org id. Index. |
| login | string | Index. |
| type | `"user"` or `"org"` | |
| installationId | number, optional | Missing after uninstall. Index. |
| plan | `"free"`, `"25gb"`, `"100gb"`, `"500gb"` or `"custom"` | Custom is for accounts above 500 GB, with a limit set by hand. |
| storageLimitBytes | number | From plan. |
| storageBytes | number | Added at upload confirm, subtracted by `collectImages`. |
| overLimitSince | number, optional | Start of grace period. Set when `storageBytes` reaches the limit, cleared when it drops under. |
| billingCustomerId | string, optional | Dodo Payments customer id, set by the first active subscription. |
| billingSubscriptionId | string, optional | The Dodo Payments subscription that sets the plan. Cleared when it ends. |
| billingStatus | string, optional | Dodo status of that subscription, like `active` or `on_hold`. |
| billingInterval | `"monthly"` or `"yearly"`, optional | Interval of that subscription's product. |
| billingPeriodEndsAt | number, optional | `next_billing_date` of that subscription: when it renews, or when it ends if it is cancelled at that date. |
| billingCancelsAtPeriodEnd | boolean, optional | `cancel_at_next_billing_date` of that subscription. |
| deletedAt | number, optional | |

### accountMembers

Which signed-in users can see which account. `me.refreshAccounts` rewrites a user's rows from `GET /user/installations` with the user's GitHub token, at sign-in and on the Install page.

| Field | Type | Notes |
|---|---|---|
| userId | Id<"users"> | Index `by_userId`. |
| accountId | Id<"accounts"> | Index `by_accountId_and_userId`. |
| role | `"owner"` or `"member"`, optional | For org accounts, saved by `members.refreshRole` from GitHub. Missing until the user opens an account page. User accounts work it out from the login instead. |

### projects

| Field | Type | Notes |
|---|---|---|
| accountId | Id<"accounts"> | Index. |
| githubRepoId | number | Survives renames. Index. |
| owner, name | string | For URLs. Index `by_owner_and_name`. Updated by the `repository` webhook. |
| private | boolean | |
| defaultBranch | string | |
| autoApproveBranches | string[] | Glob patterns. |
| diffThreshold | number | Default 0.1. |
| diffIncludeAA | boolean | Default false. |
| prRetentionDays | number | Default 60. |
| nextBuildNumber | number | Read and incremented in the mutation that creates a build. Convex mutations are serializable, so numbers never collide. |
| lastBuildAt | number, optional | Set when a build is created. Sorts the account home and tells whether the project has builds. |
| archivedAt | number, optional | Set when access is removed. |

The account home lists projects through `by_accountId_and_lastBuildAt` or `by_accountId_and_name`, and searches them with the search index `search_name` on `name`, filtered by `accountId`.

### projectTokens

| Field | Type | Notes |
|---|---|---|
| projectId | Id<"projects"> | Index. |
| name | string | |
| tokenHash | string | SHA-256 hex of the token. Index. Token format `sop_` plus 43 random base62 characters. |
| createdBy | Id<"users"> | |
| lastUsedAt | number, optional | |
| revokedAt | number, optional | |

### builds

| Field | Type | Notes |
|---|---|---|
| projectId | Id<"projects"> | |
| number | number | Unique per project. |
| buildName | string | Default `default`. |
| commitSha | string | Head SHA, never the synthetic merge SHA. |
| commitMessage | string | First line, from the client. |
| branch | string | |
| baselineBranch | string | PR base or default branch. |
| mergeBaseSha | string, optional | From the client or the compare API. |
| ancestors | string[] | Up to 100 SHAs from the client. Cleared at finalize. |
| prNumber | number, optional | |
| prClosedAt | number, optional | Set by the `pull_request` closed webhook, cleared on reopened. Starts the retention clock. |
| mergedPrNumber | number, optional | For squash-merged main builds. |
| nonce | string | |
| shardsTotal | number, optional | Missing in finalize mode. |
| shardsJoined | number, optional | Shards numbered by the server in `--shard auto` mode. |
| doneShardIndexes | number[] | Shard indexes that called complete. A retried complete does not count twice. |
| subset | boolean | True with `--subset`, disables `removed`. |
| status | `"pending"`, `"finalized"`, `"expired"`, `"error"` | |
| conclusion | `"no_changes"`, `"changes"`, `"approved"`, `"rejected"`, optional | |
| autoApproved | boolean | |
| fullRows | boolean | True while every snapshot has a row, including unchanged ones. False from the start for subset builds. GC sets it false when it prunes unchanged rows. Only full builds can be baselines. |
| baselineBuildId | Id<"builds">, optional | Missing for orphans. |
| supersededById | Id<"builds">, optional | |
| counts | object | `{unchanged, changed, added, removed, failed, pending, approved, rejected}`. Kept in sync by every mutation that changes a snapshot, so pages never count rows. |
| storageBlocked | boolean | Set at create when the account is over its limit after grace. |
| expiryJobId | Id<"_scheduled_functions">, optional | The scheduled expiry, cancelled at finalize. |
| githubCheckRunId | number, optional | Left from check runs. No longer written. |
| checkVersion | number | Incremented by every change that affects the check. |
| checkOutOfSync | boolean | True until a sync of the current `checkVersion` lands on GitHub. Index `by_checkOutOfSync`, read by the `syncChecks` cron. |
| checkSyncScheduledAt | number, optional | Set while a sync action is scheduled, so a build has one sync at a time. Treated as stuck after 5 minutes. |
| ciProvider, ciRunUrl | string, optional | |
| finalizedAt | number, optional | |

Indexes:
- `by_projectId_and_number` on `[projectId, number]`, for build pages.
- `by_projectId_and_buildName_and_nonce` on `[projectId, buildName, nonce]`, for shards joining a build.
- `by_projectId_and_buildName_and_commitSha` on `[projectId, buildName, commitSha]`, for baseline lookup.
- `by_projectId_and_buildName_and_prNumber` on `[projectId, buildName, prNumber]`, for carry-over and superseding.
- `by_projectId_and_branch` on `[projectId, branch]`, for the branch filter and branch activity in `deleteOldBuilds`.
- `by_projectId_and_prNumber` on `[projectId, prNumber]`, for the pull request filter and `pull_request` webhooks.
- `by_projectId_and_status_and_conclusion` on `[projectId, status, conclusion]`, for the states filter.
- `by_baselineBuildId` on `[baselineBuildId]`, so `deleteOldBuilds` keeps builds that are another build's baseline.
- The builds list uses `by_projectId_and_number` in descending order.

### deletedBuilds

One row per build that `deleteOldBuilds` deleted, so an old link can say why it is gone. Deleted with the project.

| Field | Type | Notes |
|---|---|---|
| projectId | Id<"projects"> | |
| number | number | The deleted build's number. |
| branch | string | |
| prNumber | number, optional | |
| reason | `pr_closed` or `branch_inactive` | Which retention rule deleted it. |
| retentionDays | number | `prRetentionDays` when it was deleted. `_creationTime` is when. |

Index: `by_projectId_and_number` on `[projectId, number]`.

### snapshots

| Field | Type | Notes |
|---|---|---|
| buildId | Id<"builds"> | |
| shardIndex | number | |
| name | string | |
| imageId | Id<"images">, optional | Missing for `removed`. |
| baselineSnapshotId | Id<"snapshots">, optional | |
| baselineImageId | Id<"images">, optional | Copied for fast display. |
| diffImageId | Id<"images">, optional | Only for `changed`. |
| diffStatus | `"unchanged"`, `"changed"`, `"added"`, `"removed"`, `"failed"` | |
| diffRatio | number, optional | 0 to 1. |
| diffPixels | number, optional | |
| reviewState | `"none"`, `"pending"`, `"approved"`, `"rejected"` | |
| metadata | object | `{browser, viewport, os, testFile, testLine, ...}`, max 4 KB. |

Indexes:
- `by_buildId_and_name` on `[buildId, name]`. Name is unique in a build; the create mutation checks it.
- `by_buildId_and_diffStatus_and_name` on `[buildId, diffStatus, name]`, for the sidebar groups, sorted by name.
- `by_imageId` on `[imageId]`, for GC reference checks and snapshot history.
- `by_baselineImageId` and `by_diffImageId`, for GC reference checks.

Row pruning (the daily cron):
- PR builds: delete unchanged rows once the PR is closed.
- Builds on auto-approve branches: keep full rows for the newest 20 per build name and anything newer than 90 days. After that, delete unchanged rows and set `fullRows` false. Changed and added rows stay forever, because snapshot history reads them.

### reviews

Append-only audit of every review action. The current state lives on `snapshots.reviewState`.

| Field | Type | Notes |
|---|---|---|
| snapshotId | Id<"snapshots"> | Index. |
| buildId | Id<"builds"> | Index. |
| userId | Id<"users">, optional | Missing for automatic actions. |
| action | `"approve"`, `"reject"`, `"undo"` | |
| source | `"user"`, `"approve_all"`, `"carry_over"`, `"auto_branch"`, `"orphan"` | |
| sourceReviewId | Id<"reviews">, optional | For carry-over, the original approval. |
| comment | string, optional | Max 500 chars. |

For carry-over lookups there is also `by_projectId_and_buildName_and_prNumber_and_imageId` on a small `approvedImages` table: `{projectId, buildName, prNumber, imageId, reviewId}`, written on every approval. One index range answers "was this exact image approved on this PR".

### images

| Field | Type | Notes |
|---|---|---|
| accountId | Id<"accounts"> | Images are scoped per account, so one account can never reach another's image by guessing a hash. |
| hash | string | SHA-256 hex of the file bytes. |
| kind | `"screenshot"` or `"diff"` | |
| bytes | number | From `_storage.size`, or from the Worker receipt for R2, not from the client. |
| width, height | number | Sent by the client, not checked. |
| store | `"convex"` or `"r2"` | Which store holds the bytes. New uploads go to R2 when `IMAGES_URL` is set. |
| storageId | Id<"_storage">, optional | Set when `store` is `"convex"` and the upload is confirmed. |
| r2Key | string, optional | Set when `store` is `"r2"`: `a/{accountId}/img/{hash[0:2]}/{hash}.png`. |
| lastReferencedAt | number | Set at confirm. `createUploadTargets` moves it forward when a build reuses the image and it is over 12 hours old, so `collectImages` never deletes an image a pending build relies on. |
| projectId | Id<"projects">, optional | The first project whose snapshot used the image, set by `insertSnapshots`. Usage counts the image for this project only. Rows stored before the fields existed get both from the `usage` cron, since a PR build reusing one cannot tell whether a kept build used it. |
| baseline | boolean, optional | True once a build on the default branch or an auto-approve branch uses the image, since retention keeps those builds. Usage counts it as a baseline, otherwise as a PR-only image. Diff images count as diffs either way. |

Index `by_accountId_and_hash` on `[accountId, hash]`, unique by code. The same PNG in two accounts is stored twice. Index `by_storageId` lets a confirm check that no image row already uses a `storageId`.

An image row is created only after an upload is confirmed (see 7.3), so there is no "pending upload" state to clean up in this table.

### usageDaily

| Field | Type | Notes |
|---|---|---|
| accountId | Id<"accounts"> | |
| projectId | Id<"projects"> | |
| day | string | `YYYY-MM-DD`, UTC. Indexes `by_projectId_and_day` and `by_accountId_and_day`. |
| baselineBytes, prBytes, diffBytes | number | Sum of `images.bytes` for the project's images: diff images, then baseline screenshots, then the rest. Written by the `usage` cron. |
| builds, snapshots, uploadedImages | number | Builds created in the 24 hours before the count, their snapshots, and images first stored in that time. For our own dashboards, not billing. |

### repoPermissions (cache)

| Field | Type | Notes |
|---|---|---|
| userId | Id<"users"> | Index `by_userId_and_projectId`. |
| projectId | Id<"projects"> | |
| permission | `"none"`, `"read"`, `"write"`, `"admin"` | |
| orgOwner | boolean | |
| checkedAt | number | When GitHub was last asked. |
| freshness | `"fresh"`, `"stale"`, `"expired"`, optional | Set to `fresh` on every save, `stale` by a scheduled mutation 5 minutes later, `expired` 10 minutes after that. A missing value counts as `expired`. |
| freshnessJobId | Id<"_scheduled_functions">, optional | The next scheduled change, cancelled when the row is saved again. |

### githubEvents

| Field | Type | Notes |
|---|---|---|
| deliveryId | string | `X-GitHub-Delivery`. Index. For idempotency. |
| event | string | |

Rows older than 7 days are deleted by the daily cron.

## 7. CI API

Convex HTTP actions in `packages/backend/convex/http.ts`, served at `https://<deployment>.convex.site/api/v1` ([docs](https://docs.convex.dev/functions/http-actions)). A custom domain comes later (unverified which Convex plan allows it). The CLI reads the base URL from `STATEOFPIXEL_API_URL` and defaults to production. JSON bodies. Auth header `Authorization: Bearer <token>`.

### 7.1 Auth

Two token kinds:

- GitHub Actions OIDC token with audience `stateofpixel`. `convex/ciAuth.ts` verifies it with `jose` against `https://token.actions.githubusercontent.com/.well-known/jwks` (issuer `https://token.actions.githubusercontent.com`, RS256) and maps the `repository_id` claim to a project that is not archived. It is not a `customJwt` provider in `convex/auth.config.ts`, so a CI token is never a signed-in identity for app queries and mutations. `POST /builds` checks that the `sha` claim matches `git.commit`, or that the `ref` claim is `refs/pull/{prNumber}/merge` for the PR the build claims (the `sha` claim is the synthetic merge commit on `pull_request` runs).
- Project token (`sop_...`). The action hashes it and looks it up by `tokenHash`. Revoked tokens and tokens of archived projects are rejected. `lastUsedAt` is written at most once a minute.

A missing or rejected token returns 401 with code `unauthorized`.

### 7.1.1 GET /whoami

Returns `{ "project": "owner/name", "method": "oidc" | "token" }` for a valid token. The CLI can use it to check its setup.

### 7.2 POST /builds

Creates a build or joins it by nonce. Called once per shard.

Request:

```json
{
  "buildName": "default",
  "nonce": "8123456789-1",
  "shard": { "index": 1, "total": 4 },
  "subset": false,
  "git": {
    "commit": "d4e5f6...",
    "commitMessage": "New header",
    "branch": "feat/header",
    "baselineBranch": "main",
    "prNumber": 88,
    "mergeBase": "0a1b2c...",
    "ancestors": ["0a1b2c...", "99aa00...", "..."]
  },
  "ci": { "provider": "github-actions", "runUrl": "https://github.com/..." },
  "snapshots": [
    { "name": "Header/Default [chromium 1280]", "hash": "sha256 hex", "bytes": 84211,
      "width": 1280, "height": 720, "metadata": { "browser": "chromium" } }
  ]
}
```

`shard.total` is `null` in finalize mode. With `--shard auto` the CLI also sends `shard.index` as `null`, and the server numbers joining shards 1, 2, 3 in order and returns the number as `shardIndex`. `ancestors` is up to 100 SHAs, and may be empty for shallow checkouts.

What the action does:

1. Auth, then one mutation that creates or joins the build by nonce. On create it also schedules the expiry mutation with `ctx.scheduler.runAfter(60 min)` ([docs](https://docs.convex.dev/scheduling/scheduled-functions)). Scheduling inside the mutation is atomic with the insert.
2. Baseline selection (section 7.6) in one query.
3. Hash lookups in chunks of 1,000 names, several chunks in parallel. Each chunk is one internal query that reads the baseline snapshot by `by_buildId_and_name` and the image by `by_accountId_and_hash`. 1,000 names is 2,000 index ranges, under the 4,096 limit.
4. One mutation per chunk of 1,000 that gets upload URLs from `blobs.createUploadTargets`, one per hash the account does not have yet (Convex `generateUploadUrl`, [docs](https://docs.convex.dev/file-storage/upload-files)).
5. Baseline URLs from `blobs.getUrl` for changed names, signed for private projects (section 11, Private images).

Response:

```json
{
  "buildId": "k17...",
  "buildNumber": 411,
  "shardIndex": 1,
  "url": "https://.../acme/web-app/builds/411",
  "diff": { "threshold": 0.1, "includeAA": false },
  "baseline": { "buildNumber": 405, "commit": "0a1b2c..." },
  "snapshots": [
    { "name": "Header/Default [chromium 1280]", "status": "changed",
      "baselineUrl": "https://<deployment>.convex.cloud/api/storage/...",
      "uploadUrl": "https://<deployment>.convex.cloud/api/storage/upload?token=..." },
    { "name": "Footer [chromium 1280]", "status": "unchanged" },
    { "name": "Header/Promo [chromium 1280]", "status": "added",
      "uploadUrl": "https://..." }
  ],
  "warnings": ["Storage at 82% of the 10 GB limit."]
}
```

Status here is the hash-level answer: `unchanged` when hashes match, `changed` when the baseline has a different hash, `added` when there is no baseline. `uploadUrl` is present only when the account does not have that hash. If the same hash appears under several names, it gets one upload URL. A storage-blocked build (4.10) gets no `uploadUrl` and no `baselineUrl`.

Upload URLs are valid for 1 hour, and each upload POST has a 2 minute timeout. The CLI POSTs the raw PNG with `Content-Type: image/png` and gets back `{ "storageId": "..." }`.

### 7.3 POST /builds/{id}/shards/{index}/complete

Sent after uploads and local diffs are done. For diff images the CLI first calls `POST /builds/{id}/upload-urls` with `{ "hashes": [...] }` to get upload URLs, the same way as in 7.2.

```json
{
  "uploads": [
    { "hash": "sha256 hex", "storageId": "kg2...", "kind": "screenshot", "width": 1280, "height": 720 },
    { "hash": "sha256 hex", "storageId": "kg3...", "kind": "diff", "width": 1280, "height": 720 }
  ],
  "results": [
    { "name": "Header/Default [chromium 1280]", "hash": "sha256 hex", "status": "changed",
      "diffHash": "sha256 hex", "diffRatio": 0.0084, "diffPixels": 7742,
      "metadata": { "browser": "chromium" } },
    { "name": "Button [chromium 1280]", "hash": "sha256 hex", "status": "unchanged" }
  ],
  "errors": []
}
```

Response: `{ "rejectedUploads": ["sha256 hex"] }`, the hashes whose upload was missing or did not match.

The client sends `unchanged` for snapshots whose bytes differed but pixels did not. The server decides `added` and hash-equal `unchanged` itself from the baseline; the client status only chooses between `changed` and `unchanged` when hashes differ, or reports `failed`. A snapshot whose image is not in the account after the uploads is `failed`. A non-empty `errors` array moves the build to `error`. Snapshots of an orphan build are inserted as approved with a `reviews` row of source `orphan`.

Confirming uploads, per chunk of 1,000:
1. Read `_storage` for each `storageId` with `ctx.db.system.get` ([docs](https://docs.convex.dev/file-storage/file-metadata)). Convex computed its `sha256` on upload. It is base64 on a local deployment even though the type comment says hex, so the server accepts both. A `storageId` that an image row already uses is never deleted or reused for another hash or account.
2. If it does not match the claimed hash, delete the file and mark the snapshot `failed`.
3. If an image with that hash already exists for the account (two shards uploaded the same PNG at once), delete the new file and point to the existing image.
4. Otherwise insert the `images` row.

Then insert snapshot rows in chunks of 1,000, carrying over approvals through `approvedImages` as they are inserted (4.6), add the shard index to `doneShardIndexes`, and when it holds `shardsTotal` indexes, schedule the finalize mutation with `runAfter(0)`.

Finalize, in chunked mutations:
1. Compute `removed` (baseline names missing from this build), unless `subset`.
2. Set counts and conclusion, mark earlier builds on the same PR as superseded, cancel the expiry job.
3. Schedule the action that updates the GitHub check.

### 7.4 POST /builds/finalize

For finalize mode. Body `{ "buildName": "default", "nonce": "...", "skipIfEmpty": false, "git": {...}, "ci": {...} }`, with `git` and `ci` shaped as in 7.2. Finalizes with whatever shards arrived, and returns 404 `build_not_found` when no shard created the build. With `skipIfEmpty` it creates an empty subset build from `git` instead, which finalizes as `no_changes` and is never a baseline.

### 7.5 GET /builds/{id}

Returns status, conclusion, counts, URL and `shards: { done, total }`. The CLI polls it until the build is finalized.

### 7.6 Baseline selection

In one internal query:
1. For each SHA in `ancestors`, newest first, look up `by_projectId_and_buildName_and_commitSha` for this build name.
2. Take the first build that is finalized, has conclusion `approved` or `no_changes`, and has `fullRows`.
3. If none matches (shallow checkout, or a branch older than the 90-day full-row window), the `POST /builds` action asks the GitHub compare API (`GET /repos/{owner}/{repo}/compare/{base}...{head}`, status `ahead` or `identical`) whether the newest 5 candidate builds on the baseline branch are ancestors of the head commit, and takes the newest one that is. It runs before the create mutation and only when the nonce has no build yet, so shards that join do not call GitHub.
4. If still none, the build is an orphan. The build header shows "First build, no baseline".

### 7.7 Errors

`{ "error": { "code": "too_many_snapshots", "message": "..." } }` with HTTP status. The CLI prints the message and exits 1 for 4xx caused by config, and exits 0 with a warning for 5xx (proposal: our outage should not break their CI). A 429 from a rate limit is handled the same way: the CLI prints the message and exits 0. A 5xx or network error from the GitHub Actions OIDC token request is retried and handled the same way. On a `pull_request` run from a fork (the head repository differs from `repository.full_name` in the event payload) GitHub sets no OIDC request variables, so the CLI prints a warning and exits 0. `--strict` makes 5xx, 429 and fork skips exit 1. HTTP actions are not retried by Convex, so the CLI retries 5xx and network errors 3 times with backoff; every endpoint is idempotent by nonce, shard index and hash.

## 8. App functions

The web app talks to Convex directly with queries and mutations through `@convex-dev/react-query`. There is no REST API for the app. Queries are live, so the builds list and build page update by themselves when CI uploads or someone reviews.

Permission check pattern. Queries cannot call GitHub, so:
1. Every query and mutation reads `repoPermissions` for the user and project.
2. If the row is missing or not `fresh`, the page calls the `permissions.refresh` action, which calls `GET /repos/{owner}/{repo}` with the user's token (the `permissions` field has `admin`, `maintain`, `push`, `pull`) and writes the row. The query re-runs by itself when the row changes. Queries never read the clock: freshness is a field that scheduled mutations change, so every query sees the same state and re-runs together when it changes. A `stale` row still grants access, so pages keep showing data while the refresh runs; an `expired` or missing row grants nothing.
3. Until then the page shows a skeleton. Public repos skip the check for reading.

Mutations and actions that need a permission throw a `ConvexError` with code `permission_unknown` when the row is missing or expired, `forbidden` when the level is too low, and `not_found` when the level is `none`. Queries do not throw for permissions: they return `null`, or an empty page for paginated queries, and the page shows a skeleton until `projects.access` settles.

| Function | Kind | Permission | Purpose |
|---|---|---|---|
| `me.accounts` | query | signed in | The accounts the user can see, and whether each is installed. |
| `me.installUrl` | query | signed in | The GitHub App install URL. |
| `me.refreshAccounts` | action | signed in | `GET /user/installations` with the user token, links the user to accounts. Runs at sign-in and from "Refresh" on the Install page. |
| `permissions.refresh` | action | signed in | See above. Writes `none` when GitHub answers 404. `orgOwner` comes from the org membership role, or from the login for a user account. |
| `projects.access` | query | signed in | Project id, cached permission, whether it is fresh, `canRead`, `canWrite` and `canAdmin`, and for users who can write the account's type, storage usage, subscription and the user's role in it (`null` while unknown or when the user is not a member). The page calls `permissions.refresh` while it is not fresh. |
| `accounts.home` | query | account member | The account, its installation settings URL, its storage usage (plan, bytes, limit, `overLimitSince`), its subscription (id, status, interval, period end and whether it cancels then), whether it has a billing customer, and the user's role (`owner`, `member` or `null` while unknown). The page works out the storage state with the clock, since queries do not read it. |
| `accounts.setPlan` | internal mutation | Convex dashboard or `npx convex run` | Sets `plan` and `storageLimitBytes`. A `custom` plan takes the limit as an argument. For plans set by hand; paid plans come from billing. |
| `accounts.projects` | query | account member | Paginated projects with their latest build, searchable, sorted by name or last build. |
| `members.list` | query | account member | Up to 200 members: login, name, avatar, role and last sign-in, owners first. |
| `members.refreshRole` | action | account member | Asks GitHub whether the user owns the account and saves `role`. The account pages call it once per page load. |
| `builds.list` | query | read | Paginated with `.paginate()`, filters branch, pull request and a list of states. |
| `builds.get` | query | read | Build and counts by number. |
| `builds.deleted` | query | read | For a number under `nextBuildNumber` with no build: its `deletedBuilds` row, or `null` when it has none. `null` for any other number. |
| `snapshots.list` | query | read | Paginated sidebar list by `by_buildId_and_diffStatus_and_name`: name, statuses and diff ratio, no image URLs. |
| `snapshots.get` | query | read | One snapshot with metadata, review info, history and whether it looks flaky (section 4.9). |
| `reviews.apply` | mutation | write | `{ buildId, snapshotIds or "all", action, comment }`. "all" runs in chunks of 1,000 through scheduled mutations; the UI shows progress from `counts`. |
| `baselines.current` | query | read | Every build name seen on the default branch, each with its newest full approved build. |
| `baselines.list` | query | read | Paginated snapshots of one build name's baseline, with an optional name prefix. |
| `baselines.history` | query | read | Changed rows for one name on the default branch. |
| `projects.settings` | query | admin | The settings page fields. |
| `projects.updateSettings` | mutation | admin | Partial update. |
| `tokens.list` | query | admin | Tokens that are not revoked: name, created time, last used time. |
| `tokens.create` | action | admin | Generates the token, stores the hash through an internal mutation, returns the token once. |
| `tokens.revoke` | mutation | admin | |
| `projects.remove` | mutation | admin | Checks the typed name, deletes the project, schedules chunked deletion of its data. |
| `usage.get` | query | account owner | `{ login, since }` with `since` a `YYYY-MM-DD` day, since queries do not read the clock. Returns the storage usage, the latest counted day, one row per project from that day and the daily account totals from `since`. `null` for anyone who is not an owner. |
| `images.grant` | mutation | read access | `{ projectId }`. Returns `{ exp, sig }` for the private image links of that project (section 11). |
| `billing.available` | query | anyone | Whether this deployment has a Dodo API key. |
| `billing.checkout` | action | account owner | `{ login, plan, interval }`. Returns a Dodo Payments checkout URL for a paid plan, monthly or yearly. Throws `already_subscribed` when the account has a subscription. |
| `billing.previewPlanChange` | action | account owner | `{ login, plan, interval }`. Returns `{ amount, currency, renewsAt }` for moving the subscription to that product: the amount charged now in minor units and the new next billing date. Throws `not_subscribed` without a subscription, `same_plan` for the current product and `over_plan_limit` when `storageBytes` is above the new plan's limit. |
| `billing.changePlan` | action | account owner | Same arguments and checks. Moves the subscription to that product with `prorated_immediately` and `on_payment_failure: prevent_change`. Returns a payment link when Dodo needs the customer to pay on a checkout page, otherwise `null`. The webhook sets the new plan. |
| `billing.portal` | action | account owner | Returns a Dodo Payments customer portal link for payment method, invoices and cancelling. Throws `not_subscribed` without a customer. |

`reviews.apply` on superseded, pending, expired or storage-blocked builds throws a `ConvexError` with code `build_not_reviewable`. `approve` and `reject` apply to snapshots with review state `pending`, `approved` or `rejected`; `undo` sets them back to `pending` and removes the `approvedImages` rows of that image on the PR. `"all"` only touches `pending` snapshots, runs 500 per scheduled mutation (changed first, then added), and cannot undo. Every call recomputes the conclusion and bumps the GitHub check.

### Billing

Paid plans are Dodo Payments subscriptions, one product per plan and interval. The product ids per environment are in `convex/lib/billing.ts`. For a user account the owner is the user; for an org it is an org owner, checked against GitHub like `permissions.refresh`. Checkout puts the account id in the subscription metadata and returns to `/{owner}/settings/billing`.

Dodo sends subscription events to the HTTP action `POST /dodo/webhook`. It verifies the Standard Webhooks signature with `DODO_PAYMENTS_WEBHOOK_SECRET` and reads the subscription in the payload, which is its latest state, so order and duplicates do not matter:

| Subscription status | Action |
|---|---|
| `active` | Set the plan and `billingInterval` of its product, `billingCustomerId`, `billingSubscriptionId`, `billingStatus`, `billingPeriodEndsAt` and `billingCancelsAtPeriodEnd`. |
| `cancelled`, `expired`, `failed` | If it is the account's `billingSubscriptionId`, move to `free` and clear the subscription fields. |
| other (`on_hold`, `past_due`, `paused`, `pending`) | If it is the account's `billingSubscriptionId`, set `billingStatus`, `billingPeriodEndsAt` and `billingCancelsAtPeriodEnd`. The plan stays. |

A plan change keeps the subscription id and sends `subscription.plan_changed` with the new `product_id`, which the `active` row handles. With `prorated_immediately` Dodo credits the unused time on the old product, charges a full cycle of the new one and moves the billing date to the day of the change ([docs](https://docs.dodopayments.com/developer-resources/subscription-upgrade-downgrade)). Downgrades work the same way, and a credit larger than the charge pays toward later renewals.

The customer portal offers two ways to cancel. "Cancel now" ends the subscription at once, so the account moves to `free` on that event. "Cancel at next billing date" keeps the subscription `active` with `cancel_at_next_billing_date` until the period ends, so the plan stays until then and the plan box shows the end date (5.10).

Moving to `free` can put the account over its limit, which starts the grace period of section 4.10.

## 9. GitHub integration

GitHub App permissions:

| Permission | Level | Why |
|---|---|---|
| Commit statuses | write | Set the check on the build's commit. |
| Checks | write | Not used since the move to commit statuses. Drop it once every installation accepted Commit statuses. |
| Pull requests | read and write | PR number, base branch, squash merge lookup. Write is not used yet. |
| Contents | read | Compare API for baseline fallback. |
| Actions | read | Not used yet. |
| Metadata | read | Required by GitHub. |

The app's OAuth settings are also what Convex Auth uses for sign-in (section 6).

Webhooks go to the HTTP action `POST /github/webhook`. It reads the raw body, verifies `X-Hub-Signature-256` with the webhook secret using `crypto.subtle` HMAC, dedupes by delivery id, and hands the event to an internal mutation.

| Event | Action |
|---|---|
| `installation` created, deleted, suspend, unsuspend | Create or archive account and projects. |
| `installation_repositories` added, removed | Create or archive projects. |
| `repository` renamed, transferred, edited | Update owner, name, default branch, private flag. |
| `pull_request` closed, reopened | Set or clear `prClosedAt` on that PR's builds. Closing starts their retention clock. The GitHub App must subscribe to the Pull request event. |

GitHub API calls (commit statuses, compare, PR lookup) run in actions with an installation token made from the app's private key. Octokit uses Web Crypto and probably runs in the default Convex runtime (unverified); if not, those actions move to a `"use node"` file. Scheduled actions run at most once and are not retried ([docs](https://docs.convex.dev/scheduling/scheduled-functions)), so every state change bumps `checkVersion` and schedules `checks.sync` unless one is already scheduled. The sync posts a commit status for the build's context, which replaces the previous one, then clears `checkOutOfSync` only when the version it sent is still current; otherwise it runs again. A cron every 5 minutes retries builds that are still out of sync. A 422 from GitHub, for example for a commit GitHub does not have, is not retried. A 403 from an installation that has not accepted the Commit statuses permission keeps retrying, so the check appears once the owner accepts. The check name is `stateofpixel`, or `stateofpixel/<buildName>` for other build names, on the build's head commit.

Status content: the state and description from the mapping table in section 3, with the build page as `target_url`.

## 10. CLI

Package `stateofpixel`, closed source, published unminified with source maps. Node 20 or newer. `odiff-bin` as optional dependency, pixelmatch and pngjs bundled.

### Commands

Commands, flags, defaults and env vars are defined once in `packages/cli/src/reference.ts`. `index.ts` builds commander from it, and [/docs/cli](https://stateofpixel.com/docs/cli) renders its tables from it. Commands: `upload <dir>` (hash, upload, diff, complete a shard), `storybook <static-dir>` (capture every story with Playwright, then upload; with `--shard i/n` only every n-th story from the i-th), `finalize` (finish a build in finalize mode) and `compare <dir> <baseline-dir>` (local only, writes `stateofpixel-report/index.html`). Without a nonce on a runner other than GitHub Actions, a single-shard upload uses `local-<timestamp>`, and sharded uploads and `finalize` fail.

Snapshot name from a folder upload is the path relative to `<dir>` without `.png`, like `components/Button/primary`.

A `<name>.meta.json` file next to `<name>.png` is sent as that snapshot's metadata. Git info comes from the GitHub Actions env and event payload (the PR head SHA, not the merge SHA) and from local git; `ancestors` is `git rev-list` of the commit, or of `HEAD` without the merge commit when the PR head is not in a shallow checkout. The API base URL is `STATEOFPIXEL_API_URL`, default `https://graceful-dogfish-423.convex.site/api/v1` until a custom domain exists.

### Playwright integration

A reporter plus a `snapshot(page, name)` helper, with setup in `apps/web/src/content/docs/playwright.mdx`. `snapshot` applies the flakiness defaults (animations disabled, caret hidden, fonts loaded), appends `[browser width]` to the name, saves a full-page PNG into `stateofpixel-screenshots` (or `STATEOFPIXEL_DIR`) and writes metadata next to it. The reporter clears that folder when the run begins and uploads it once the run ends, per shard when Playwright sharding is on. It uploads only when `CI` is set, unless the reporter option `uploadOutsideCi` is true, and marks the upload as a subset when the run did not pass. Reporter options: `buildName`, `nonce`, `baselineBranch`, `subset`, `threshold`, `strict`, `uploadOutsideCi`. Storybook captures and the Playwright helper use the Playwright the project installs, an optional peer dependency.

### Output

```
stateofpixel  build #411  feat/header vs main (#405)
  1,500 snapshots  1,488 unchanged  10 changed  2 added  1 removed
  uploaded 22 images (1.3 MB) in 2.1 s
  review: https://.../acme/web-app/builds/411
```

Exit code is 0 when changes exist. The GitHub check decides whether the PR can merge, not the CI job. Exit 1 on config errors, auth errors, or failed uploads.

## 11. Storage and retention

### Where bytes live

PNGs live in Convex File Storage or in Cloudflare R2 behind the Worker in `apps/images`. When the Convex env var `IMAGES_URL` (the Worker's URL) is set, new uploads go to R2; otherwise they go to Convex. Existing images stay where they are, since `images.store` is per row. All storage code sits in `packages/backend/convex/blobs.ts`:

| Function | Convex | R2 |
|---|---|---|
| `createUploadTargets(hashes)` | `ctx.storage.generateUploadUrl()` per hash | Worker upload link per hash, signed below |
| `confirmUpload(hash, ref)` | check `_storage.sha256`, return `storageId` | verify the Worker receipt |
| `getUrl(image, project)` | public project: `ctx.storage.getUrl(storageId)`; private project: the image route below | Worker link with an image signature |
| `readImage(storageId)` | `ctx.storage.get(storageId)`, for the image route | the Worker reads R2 |
| `delete(image)` | `ctx.storage.delete(storageId)` | schedules `deleteR2Object`, which calls the Worker |

Nothing else in the backend touches `ctx.storage` or R2.

### R2 and the images Worker

The Worker (`apps/images/src/index.ts`) holds the R2 binding, so Convex has no R2 credentials. Both sides sign with `IMAGE_URL_SECRET` through `convex/lib/signing.ts`, HMAC-SHA256 in base64url:

| Route | Signed message | Check |
|---|---|---|
| `POST /upload/{accountId}/{hash}?exp&sig` | `upload.{accountId}.{hash}.{exp}`, valid 1 hour | Body at most 20 MiB and its SHA-256 equals `hash`, then put to `r2Key`. Returns `{ storageId: "r2:{bytes}.{sig}" }` with `sig` over `stored.{r2Key}.{bytes}`, the same response shape as a Convex upload, so the CLI needs no change. |
| `GET /images/{projectId}/{accountId}.{hash}.{imageSig}?exp&sig` | grant as below, plus `image.{projectId}.{r2Key}` | Private projects. The image signature ties the image to the project, the grant gives the time limit. |
| `GET /files/{accountId}.{hash}.{sig}` | `public.{r2Key}` | Public projects. Never expires, like a Convex storage URL. |
| `DELETE /objects/{r2Key}?before&sig` | `delete.{r2Key}.{before}` | Deletes only if the object was uploaded before `before`, so a pending delete never removes the same hash uploaded again after it. |

Confirm trusts the receipt for the size, since the Worker hashed and measured the body. The Worker keeps objects in the Cloudflare edge cache, which works only on a custom domain; on `workers.dev` every read goes to R2. Unlike the Convex route, the Worker does not check that the project is archived or that the image still exists in Convex, so an archived project's images stay reachable until the grant expires, at most 2 hours. An upload that is never confirmed leaves an object in R2 with no row.

Things to know about Convex File Storage URLs ([docs](https://docs.convex.dev/file-storage/serve-files)):
- "Anyone with the URL can access the file without further authentication from your app." The URL does not expire; only deleting the file revokes it. So `getUrl` URLs go only to public projects, and we never store them.

### Private images

Images of private projects go through the HTTP route `GET /images/{projectId}/{imageId}?exp=...&sig=...` in `convex/images.ts`. Queries cannot read the clock, so they return the link without `exp` and `sig`, and the signature comes from a grant:

- `sig` is HMAC-SHA256 of `{projectId}.{exp}` with `IMAGE_URL_SECRET`, base64url. `exp` is the end of the next full hour, so a grant is valid for 1 to 2 hours and every grant in the same hour gives the same link, which keeps the browser cache warm.
- The web app gets a grant per project from `images.grant` and adds it to the links (`apps/web/src/lib/useImageUrl.ts`). It asks for a new one 30 minutes before `exp`.
- `POST /builds` signs baseline URLs for CI the same way.
- The route checks the signature and `exp`, that the project is not archived and that the image belongs to the project's account, then returns the bytes with `Cache-Control: private, max-age=<seconds until exp>, immutable`. A wrong or expired signature gets 403.
- Someone removed from the repo keeps images they already had for up to 2 hours, since `exp` is at most 2 hours away. HTTP action responses are limited to 20 MiB, the same as our image limit ([limits](https://docs.convex.dev/production/state/limits)).
- The open-source Convex backend sends `Cache-Control: private, max-age=2592000` on storage reads (unverified for hosted Convex). Browsers cache images for 30 days, shared CDNs do not. Images never change for a given file, so this is safe.
- Every image view is Convex egress ($0.132/GB on Starter after 1 GB). The review page loads the viewer's images only, and the sidebar shows names, not thumbnails, to keep egress down.

### Crons

In `packages/backend/convex/crons.ts` ([docs](https://docs.convex.dev/scheduling/cron-jobs)). Each cron is a small mutation that does one chunk of work and reschedules itself with `runAfter(0)` until done, so no single function hits the 1 s limit.

| Cron | Schedule | Work |
|---|---|---|
| `syncChecks` | every 5 min | Retries GitHub check updates that did not land. |
| `deleteOldBuilds` | daily 03:30 UTC | Deletes builds of PRs closed longer than `prRetentionDays` ago, and builds of branches with no new build for that long. Never deletes pending builds, builds on the default branch or an auto-approve branch, or a build that another build uses as its baseline. Deletes the build row first and writes a `deletedBuilds` row with the rule that matched, then deletes its snapshots and reviews in chunks, then the PR's `approvedImages` once no build of that PR is left. |
| `collectImages` | daily 04:00 UTC | Deletes images with no snapshot referencing them (checked through `by_imageId`, `by_baselineImageId` and `by_diffImageId`) and `lastReferencedAt` over 24 hours ago, and their stored files. Subtracts the bytes from `accounts.storageBytes`. |
| `cleanupEvents` | daily 04:30 UTC | Deletes `githubEvents` older than 7 days. |
| `usage` | daily 05:00 UTC | One account at a time, pages through its images and sums their bytes per project and kind. An image without `projectId` gets it and `baseline` from up to 50 snapshots that use it; an image no snapshot uses is skipped until `collectImages` deletes it. Then it writes or replaces one `usageDaily` row per project for the day, skipping archived projects with no images. |

Not built yet: `pruneRows` (daily 03:00 UTC) applies the row pruning rules from the snapshots table. `accounts.storageBytes` and `overLimitSince` are kept current by upload confirm and `collectImages`. Build expiry is not a cron: `builds.expire` is scheduled per build, 60 minutes after creation, and sets `expired` if the build is still pending.

Storage billed is the sum of `images.bytes` per account. Every image counts once, however many builds reference it.

## 12. Limits

The CI API enforces these. A request over a limit gets a 4xx with the codes in brackets, and an image over the size or dimension limit comes back in `rejectedUploads`. The values live in `convex/lib/limits.ts`, and [/docs/limits](https://stateofpixel.com/docs/limits) renders them from there.

| Limit | Constant | Why |
|---|---|---|
| Snapshots per build (`too_many_snapshots`) | `MAX_SNAPSHOTS_PER_BUILD` | Keeps a 20k manifest near 2 MB. |
| Request body for every CI call (`body_too_large`) | `MAX_BODY_BYTES` in `ciApi.ts` | Convex HTTP actions accept up to 20 MiB. The CLI splits bigger manifests into several calls with the same nonce and shard. |
| Image size | `MAX_IMAGE_BYTES` | Checked from `_storage.size` at confirm. |
| Image dimensions | `MAX_IMAGE_WIDTH`, `MAX_IMAGE_HEIGHT` | |
| Snapshot name (`snapshot_name_too_long`) | `MAX_SNAPSHOT_NAME_LENGTH` | |
| Metadata per snapshot (`metadata_too_large`) | `MAX_METADATA_BYTES` | |
| Shards per build (`invalid_shard`, `too_many_shards` for auto shards) | `MAX_SHARDS` | |
| Build timeout, creation to finalize | `BUILD_EXPIRY_MS` | |
| Requests per token (`rate_limited`, 429) | `CI_REQUESTS_PER_MINUTE` | Token bucket keyed by project token, or by project for OIDC. |
| Builds per account a day (`build_limit_reached`, 429) | `DAILY_BUILDS` | Counted when a build is created, not when a shard joins. |
| Bytes uploaded per account a day (`upload_limit_reached`, 429) | `DAILY_UPLOAD_BYTES` | Counted at upload confirm. New builds are refused once the day's bytes are used. |
| Server chunk size | `CHUNK_SIZE` in `ciApi.ts` | 1 s, 4,096 index ranges and 16,000 writes per function ([limits](https://docs.convex.dev/production/state/limits)). |

## 13. Not in v1

- Email or Slack notifications. The GitHub check is the notification.
- Comments threads on snapshots. A single reject comment only.
- Thumbnails. Generating them needs decoding on the server; the browser scales full images instead. Revisit if the Baselines grid is slow.
- Ignore regions drawn in the UI. Masks live in test code.
- Organization-level roles beyond what GitHub gives.
- Wait-for-review in CI (`--wait`).
- PR comments.
- Auto-approve of known flaky variants. Flaky detection stores nothing yet: no flaky badge in the snapshot list and no filter, tracked in ROADMAP.md.
