# stateofpixel: product spec

Companion to [PLAN.md](./PLAN.md). PLAN.md says why and how; this file says exactly what: pages, tables, API, CLI, states and flows. Items marked (proposal) are my defaults and need your call. Items marked (unverified) need a check against GitHub or Convex docs before we build on them.

Stack: pnpm monorepo, TanStack Start on Netlify, Convex for database, auth (Convex Auth) and file storage. See PLAN.md for the repo layout and dogfooding.

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
| Build name | Lets one repo run separate suites, like `storybook` and `e2e`. Default is `default`. Each build name has its own baselines and its own GitHub check. |
| Shard | One CI job uploading part of a build. A build has 1 or more shards. |
| Snapshot | One named screenshot inside a build. |
| Snapshot name | Unique inside a build. The client puts the mode in the name, for example `Button/Primary [chromium 1280]`. Same name across builds means same snapshot. |
| Image | A PNG stored once, keyed by its SHA-256. Snapshots and diffs point to images. |
| Baseline build | The approved build a new build is compared against. |
| Review | A person approving or rejecting snapshots in a build. |

Snapshot identity is only the name. Metadata (browser, viewport, OS, test file) is stored for display and filtering and never changes matching. This keeps the rule easy to explain: rename the snapshot and it is a new snapshot.

## 2. Access model

There is no separate member list. Access comes from GitHub.

| GitHub permission on the repo | Can do |
|---|---|
| none, private repo | nothing, 404 |
| none, public repo | view builds and baselines (proposal) |
| read | view builds and baselines |
| write, maintain | also review (approve, reject) |
| admin | also change project settings and tokens |
| org owner | also see account usage and billing |

The server asks GitHub for the user's permission on the repo with the user's token and caches the answer for 5 minutes (section 8 has the pattern). Removing someone from the repo on GitHub removes their access here within 5 minutes. Org owner comes from `GET /user/memberships/orgs/{org}` with the same token.

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
| `changes` | At least one `changed` or `added` snapshot is not reviewed yet, and none is rejected. |
| `approved` | Every `changed` and `added` snapshot is approved. Also set automatically on auto-approve branches and on orphan builds. |
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

| Build state | Check status | Conclusion | Title |
|---|---|---|---|
| pending | `in_progress` | | Waiting for screenshots (2 of 4 shards) |
| finalized, `no_changes` | `completed` | `success` | No visual changes |
| finalized, `changes` | `completed` | `action_required` | 12 changes to review |
| finalized, `approved` | `completed` | `success` | 12 changes approved |
| finalized, `approved` by auto-approve | `completed` | `success` | Baseline updated, 12 changes |
| finalized, `rejected` | `completed` | `failure` | 2 changes rejected |
| expired | `completed` | `timed_out` | Build never finished |
| error | `completed` | `failure` | Upload failed, see CI logs |
| over storage limit | `completed` | `neutral` | Storage limit reached, not compared |

`details_url` is always the build page. Branch protection treats `action_required` as not passing, so a PR with unreviewed changes cannot merge when the check is required (unverified, check GitHub docs).

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
3. Check: action_required, "12 changes to review", with a "Details" link.
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
2. New build. For each `changed` or `added` snapshot, the server looks for an approved snapshot in any earlier build of the same PR and build name with the same image hash. If found, it is approved by carry-over.
3. If all changes carry over, conclusion is `approved` right at finalize and the check is green without anyone opening the page.
4. On the build page, carried-over snapshots show "Approved in build #41 by @alice".

Rejections do not carry over (proposal). A rejected image showing up again is shown as pending with a note "Rejected in build #41", so the reviewer sees it but a stale rejection does not block forever.

### 4.7 Merge to the default branch

1. Merge creates a push on `main`. CI runs `stateofpixel upload`.
2. `main` matches the auto-approve pattern, so the build is approved and becomes the newest baseline.
3. For squash and rebase merges, the new commit is not a descendant of the PR head. The server calls `GET /repos/{o}/{r}/commits/{sha}/pulls`. If it finds a merged PR, the build page shows "From PR #123" and links the PR's last build.

Auto-approve on main means anything that lands on main is the truth. If a change was not reviewed on the PR (check not required), it still becomes the baseline. The build page for that main build marks such snapshots "Not reviewed on PR" so it is visible.

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
3. The snapshot detail panel shows its history. If the hash alternates between two values across recent builds, it shows "Looks flaky: flipped 3 times in 10 builds" and a link to the docs on masks and thresholds (M3).
4. Fix is in the user's config: raise the threshold for that snapshot, or mask the region.

### 4.10 Storage limit reached

1. Account reaches 80% of its storage limit. Account and project pages show a yellow banner. The CLI prints a warning line.
2. At 100%, a 14-day grace period starts (proposal). Everything keeps working, banner turns red.
3. After grace, builds still hash-compare, but new images are not stored. Snapshots that match the baseline are `unchanged` as usual. Anything changed is marked `not stored`, and the check is neutral, "Storage limit reached, not compared". CI never fails because of us.
4. Freeing space (shorter retention, deleting projects) or upgrading ends the state immediately.

### 4.11 Removing access

- Repo removed from the installation: project is archived, builds stay readable for org members for 30 days, then deleted with its images (proposal).
- App uninstalled: same for all projects of the account.
- Project deleted from settings: confirm by typing the repo name, delete right away, images are removed by the next GC run.

### 4.12 CI on a non-GitHub-Actions runner

1. Admin opens Settings, Tokens, "Create token". Token shown once, stored hashed.
2. User sets `STATEOFPIXEL_TOKEN` in their CI.
3. Git info comes from env-ci and local git. If the checkout is shallow and the merge base is not in local history, the server uses the GitHub compare API.

## 5. Pages

URL scheme mirrors GitHub: `/{owner}/{repo}`. Public pages (5.1) are server-rendered by TanStack Start. Signed-in pages render on the client, because Convex Auth has no TanStack Start SSR support; they show a skeleton until auth and the permission check are ready.

### 5.1 Public pages

| Path | Content |
|---|---|
| `/` | Landing. One-sentence pitch, the "how it works" diagram, a 3-line CI snippet, pricing block, Sign in button. |
| `/pricing` | Free tier, storage price, what counts as storage, retention defaults, FAQ. |
| `/docs` | Getting started, Playwright, Storybook, folder upload, sharding, baselines explained, flakiness, CLI reference, config reference. Static Markdown pages. |
| `/login` | Redirects to GitHub OAuth. |

### 5.2 Install (`/install`)

Shown when the signed-in user has no installations. One button to the GitHub App install screen. Below it: "Already installed? Refresh" for when the webhook is slow.

### 5.3 Account home (`/{owner}`)

```
+--------------------------------------------------------------+
| stateofpixel      acme v                         [avatar]    |
+--------------------------------------------------------------+
| Projects                                 Storage 3.1 / 25 GB |
|                                                              |
| web-app        #412  main   no changes     2 min ago         |
| design-system  #88   feat/x 12 to review   1 h ago           |
| marketing      no builds yet                                 |
|                                                              |
| Missing a repo? Configure access on GitHub                   |
+--------------------------------------------------------------+
```

- Account switcher for users in several orgs.
- One row per project: name, latest build number, branch, conclusion pill, relative time.
- Storage meter links to the Usage page (owners only; others see no meter).
- "Configure access on GitHub" links to the installation settings.

### 5.4 Project page (`/{owner}/{repo}`)

Tabs: Builds (default), Baselines, Settings (admins).

Builds tab:

```
+------------------------------------------------------------------+
| acme / web-app                     Builds  Baselines  Settings   |
+------------------------------------------------------------------+
| Branch [all v]  Status [all v]  Build name [all v]               |
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

- Columns: build number, conclusion pill with counts, branch, commit message (first line) and short SHA, PR number linking to GitHub, build name if the project has more than one, relative time with absolute time on hover.
- Filters are in the URL query so they can be shared.
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

Sidebar:
- Groups in order: Changed, Added, Removed, Failed, Unchanged. Unchanged is collapsed.
- Each row: name, review icon (pending, approved, rejected, carried over), diff percent for changed.
- Filter box matches name substring. `/` focuses it.
- Sorted by name inside a group.

Viewer:
- Title row: snapshot name, diff status, diff percent and pixel count, dimensions (both if they differ, like `1280x720 to 1280x812`).
- Modes:
  - Side by side: baseline left, new right, zoom and pan synced.
  - Diff: new image with the diff image overlaid in red at 70% opacity.
  - Slider: one frame, a vertical handle wipes between baseline and new.
  - Flip: one frame, space toggles between baseline and new. Best for 1-pixel shifts.
- Zoom: Fit (default), 100%, 200%. Mouse wheel with ctrl zooms, drag pans.
- Added snapshots show only the new image. Removed snapshots show only the baseline.
- Different dimensions: images align top-left, the empty area is a checkerboard.
- Chosen mode and zoom are remembered in localStorage per user.

Detail footer:
- History: last 10 builds on the baseline branch where this snapshot's hash changed, as links.
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
| `space` | In Flip mode, toggle image |
| `f` / `0` | Fit / 100% zoom |
| `/` | Focus filter |
| `?` | Shortcuts overlay |

Review actions are optimistic in the UI and send one request each. If a request fails, the icon reverts and a toast explains.

### 5.6 Baselines tab (`/{owner}/{repo}/baselines`)

Browse what is approved on the default branch now.

- Build name selector if there are several.
- Search by name.
- Grid of snapshots from the newest approved build on the default branch: image scaled down by the browser, name under it. Lazy loaded, 60 per page.
- Clicking one opens Snapshot history.

### 5.7 Snapshot history (`/{owner}/{repo}/baselines/{snapshot_name}`)

- Timeline of builds on the default branch where this name's image hash changed, newest first.
- Each entry: build number, commit, date, who approved on the PR if known, a thumbnail.
- Clicking two entries compares them in the same viewer as the build page.

### 5.8 Project settings (`/{owner}/{repo}/settings`, admin only)

| Section | Field | Default | Notes |
|---|---|---|---|
| General | Default branch | from GitHub | Read-only mirror, updated by webhook. |
| General | Auto-approve branches | `main` plus the default branch | Glob list, like `main, release/*`. |
| Diff | Threshold | 0.1 | Passed to the CLI in the build response, so config lives in one place. The CLI config overrides it. |
| Diff | Include anti-aliasing | off | |
| Checks | Check name | `stateofpixel` | With several build names: `stateofpixel / {build name}`. |
| Retention | Keep PR-only images for | 30 days | 7 to 365. Shows the storage this setting uses now. |
| Tokens | Project tokens | none | Create, name, last used time, revoke. Token shown once. |
| Danger | Delete project | | Type the repo name to confirm. |

Every change is saved on blur with a small "Saved" note. No save button.

### 5.9 Usage and billing (`/{owner}/settings/usage`, org owner only)

- Big number: storage used and limit, like `3.1 GB of 25 GB`.
- Split: baselines vs PR-only images vs diff images.
- Table per project: storage, share of total, retention setting, link to its settings.
- Chart: daily storage for the last 90 days, from `usageDaily`.
- Plan box: current plan, price per GB above the free tier, payment method, invoices (M3).

### 5.10 User menu

Avatar menu with: account switcher, Docs, Sign out. No user settings page in v1.

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
| image | string | Avatar URL. |
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
| plan | `"free"` or `"paid"` | |
| storageLimitBytes | number | From plan. |
| storageBytes | number | Updated by the daily cron. |
| overLimitSince | number, optional | Start of grace period. |
| billingCustomerId | string, optional | Payment provider id (M3). |
| deletedAt | number, optional | |

### accountMembers

Which signed-in users can see which account. `me.refreshAccounts` rewrites a user's rows from `GET /user/installations` with the user's GitHub token, at sign-in and on the Install page.

| Field | Type | Notes |
|---|---|---|
| userId | Id<"users"> | Index `by_userId`. |
| accountId | Id<"accounts"> | Index `by_accountId_and_userId`. |

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
| prRetentionDays | number | Default 30. |
| nextBuildNumber | number | Read and incremented in the mutation that creates a build. Convex mutations are serializable, so numbers never collide. |
| archivedAt | number, optional | Set when access is removed. |

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
| prClosedAt | number, optional | Set by the `pull_request` webhook. Starts the retention clock. |
| mergedPrNumber | number, optional | For squash-merged main builds. |
| nonce | string | |
| shardsTotal | number, optional | Missing in finalize mode. |
| shardsDone | number | |
| subset | boolean | True with `--subset`, disables `removed`. |
| status | `"pending"`, `"finalized"`, `"expired"`, `"error"` | |
| conclusion | `"no_changes"`, `"changes"`, `"approved"`, `"rejected"`, optional | |
| autoApproved | boolean | |
| fullRows | boolean | True while every snapshot has a row, including unchanged ones. GC sets it false when it prunes unchanged rows. Only full builds can be baselines. |
| baselineBuildId | Id<"builds">, optional | Missing for orphans. |
| supersededById | Id<"builds">, optional | |
| counts | object | `{unchanged, changed, added, removed, failed, pending, approved, rejected}`. Kept in sync by every mutation that changes a snapshot, so pages never count rows. |
| storageBlocked | boolean | Over limit after grace. |
| expiryJobId | Id<"_scheduled_functions">, optional | The scheduled expiry, cancelled at finalize. |
| githubCheckRunId | number, optional | |
| checkSyncedAt | number, optional | When the GitHub check last matched the build state. The `syncChecks` cron retries builds where this is older than the last change. |
| ciProvider, ciRunUrl | string, optional | |
| finalizedAt | number, optional | |

Indexes:
- `by_projectId_and_number` on `[projectId, number]`, for build pages.
- `by_projectId_and_buildName_and_nonce` on `[projectId, buildName, nonce]`, for shards joining a build.
- `by_projectId_and_buildName_and_commitSha` on `[projectId, buildName, commitSha]`, for baseline lookup.
- `by_projectId_and_buildName_and_prNumber` on `[projectId, buildName, prNumber]`, for carry-over and superseding.
- `by_projectId_and_branch` on `[projectId, branch]`, for the branch filter.
- The builds list uses `by_projectId_and_number` in descending order.

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
| bytes | number | From `_storage.size`, not from the client. |
| width, height | number | Sent by the client, not checked. |
| store | `"convex"` or `"r2"` | Which store holds the bytes. Only `"convex"` in v1. |
| storageId | Id<"_storage">, optional | Set when `store` is `"convex"` and the upload is confirmed. |
| r2Key | string, optional | For later. |
| lastReferencedAt | number | |

Index `by_accountId_and_hash` on `[accountId, hash]`, unique by code. The same PNG in two accounts is stored twice.

An image row is created only after an upload is confirmed (see 7.3), so there is no "pending upload" state to clean up in this table.

### usageDaily

| Field | Type | Notes |
|---|---|---|
| accountId | Id<"accounts"> | |
| projectId | Id<"projects"> | |
| day | string | `YYYY-MM-DD`, UTC. Index `by_projectId_and_day`. |
| baselineBytes, prBytes, diffBytes | number | Computed by the daily cron. |
| builds, snapshots, uploadedImages | number | For our own dashboards, not billing. |

### repoPermissions (cache)

| Field | Type | Notes |
|---|---|---|
| userId | Id<"users"> | Index `by_userId_and_projectId`. |
| projectId | Id<"projects"> | |
| permission | `"none"`, `"read"`, `"write"`, `"admin"` | |
| orgOwner | boolean | |
| checkedAt | number | Stale after 5 minutes. |

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

- GitHub Actions OIDC token with audience `stateofpixel`. `convex/ciAuth.ts` verifies it with `jose` against `https://token.actions.githubusercontent.com/.well-known/jwks` (issuer `https://token.actions.githubusercontent.com`, RS256) and maps the `repository_id` claim to a project that is not archived. It is not a `customJwt` provider in `convex/auth.config.ts`, so a CI token is never a signed-in identity for app queries and mutations. The `sha` claim must match the build's commit, or be the synthetic merge commit of the PR the build claims. Not tested from a real GitHub Actions run yet.
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

`shard.total` is `null` in finalize mode. `ancestors` is up to 100 SHAs, and may be empty for shallow checkouts.

What the action does:

1. Auth, then one mutation that creates or joins the build by nonce. On create it also schedules the expiry mutation with `ctx.scheduler.runAfter(60 min)` ([docs](https://docs.convex.dev/scheduling/scheduled-functions)). Scheduling inside the mutation is atomic with the insert.
2. Baseline selection (section 7.6) in one query.
3. Hash lookups in chunks of 1,000 names, several chunks in parallel. Each chunk is one internal query that reads the baseline snapshot by `by_buildId_and_name` and the image by `by_accountId_and_hash`. 1,000 names is 2,000 index ranges, under the 4,096 limit.
4. One mutation per chunk of 1,000 that gets upload URLs from `blobs.createUploadTargets`, one per hash the account does not have yet (Convex `generateUploadUrl`, [docs](https://docs.convex.dev/file-storage/upload-files)).
5. Baseline URLs from `blobs.getUrl` for changed names.

Response:

```json
{
  "buildId": "k17...",
  "buildNumber": 411,
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
  "warnings": ["Storage at 82% of the free tier"]
}
```

Status here is the hash-level answer: `unchanged` when hashes match, `changed` when the baseline has a different hash, `added` when there is no baseline. `uploadUrl` is present only when the account does not have that hash. If the same hash appears under several names, it gets one upload URL.

Upload URLs are valid for 1 hour, and each upload POST has a 2 minute timeout. The CLI POSTs the raw PNG with `Content-Type: image/png` and gets back `{ "storageId": "..." }`.

### 7.3 POST /builds/{id}/shards/{index}/complete

Sent after uploads and local diffs are done. For diff images the CLI first calls `POST /builds/{id}/upload-urls` with `{ "hashes": [...] }` to get upload URLs, the same way as in 7.2.

```json
{
  "uploads": [
    { "hash": "sha256 hex", "storageId": "kg2...", "kind": "screenshot" },
    { "hash": "sha256 hex", "storageId": "kg3...", "kind": "diff" }
  ],
  "results": [
    { "name": "Header/Default [chromium 1280]", "status": "changed",
      "diffHash": "sha256 hex", "diffRatio": 0.0084, "diffPixels": 7742 },
    { "name": "Button [chromium 1280]", "status": "unchanged" }
  ],
  "errors": []
}
```

The client sends `unchanged` for snapshots whose bytes differed but pixels did not.

Confirming uploads, per chunk of 1,000:
1. Read `_storage` for each `storageId` with `ctx.db.system.get` ([docs](https://docs.convex.dev/file-storage/file-metadata)). Convex computed its `sha256` on upload.
2. If it does not match the claimed hash, delete the file and mark the snapshot `failed`. Convex's sha256 encoding is not the same as our hex in every case (check base16 vs base64 before building), so compare after decoding both to bytes.
3. If an image with that hash already exists for the account (two shards uploaded the same PNG at once), delete the new file and point to the existing image.
4. Otherwise insert the `images` row.

Then insert snapshot rows in chunks of 1,000, increment `shardsDone`, and when it reaches `shardsTotal`, schedule the finalize mutation with `runAfter(0)`.

Finalize, in chunked mutations:
1. Compute `removed` (baseline names missing from this build), unless `subset`.
2. Carry over approvals through `approvedImages`.
3. Set counts and conclusion, mark earlier builds on the same PR as superseded, cancel the expiry job.
4. Schedule the action that updates the GitHub check.

### 7.4 POST /builds/finalize

For finalize mode. Body `{ "buildName": "default", "nonce": "..." }`. Finalizes with whatever shards arrived. With `--skip-if-empty` and no shards, it creates a build with conclusion `no_changes` so the check does not hang.

### 7.5 GET /builds/{id}

Returns status, conclusion, counts and URL. The CLI uses it for `--wait` (M3).

### 7.6 Baseline selection

In one internal query:
1. For each SHA in `ancestors`, newest first, look up `by_projectId_and_buildName_and_commitSha` for this build name.
2. Take the first build that is finalized, approved, and has `fullRows`.
3. If none matches (shallow checkout, or a branch older than the 90-day full-row window), an action asks the GitHub compare API whether the newest 5 full builds on the baseline branch are ancestors of the head commit, and takes the newest one that is.
4. If still none, the build is an orphan. On a PR this shows a banner: "No baseline found for this branch. Rebase on main to compare."

### 7.7 Errors

`{ "error": { "code": "baseline_branch_unknown", "message": "..." } }` with HTTP status. The CLI prints the message and exits 1 for 4xx caused by config, and exits 0 with a warning for 5xx (proposal: our outage should not break their CI). `--strict` makes 5xx exit 1. HTTP actions are not retried by Convex, so the CLI retries 5xx and network errors 3 times with backoff; every endpoint is idempotent by nonce, shard index and hash.

## 8. App functions

The web app talks to Convex directly with queries and mutations through `@convex-dev/react-query`. There is no REST API for the app. Queries are live, so the builds list and build page update by themselves when CI uploads or someone reviews.

Permission check pattern. Queries cannot call GitHub, so:
1. Every query and mutation reads `repoPermissions` for the user and project.
2. If the row is missing or older than 5 minutes, the page calls the `refreshPermissions` action, which calls `GET /repos/{owner}/{repo}` with the user's token (the `permissions` field has `admin`, `maintain`, `push`, `pull`) and writes the row. The query re-runs by itself when the row changes.
3. Until then the page shows a skeleton. Public repos skip the check for reading.

Functions that need a permission throw a `ConvexError` with code `permission_unknown` when the row is missing or stale, `forbidden` when the level is too low, and `not_found` when the level is `none`. The page calls `permissions.refresh` on `permission_unknown` and retries.

| Function | Kind | Permission | Purpose |
|---|---|---|---|
| `me.get` | query | signed in | User and the accounts they can see. |
| `me.refreshAccounts` | action | signed in | `GET /user/installations` with the user token, links the user to accounts. Runs at sign-in and from "Refresh" on the Install page. |
| `permissions.refresh` | action | signed in | See above. Writes `none` when GitHub answers 404. `orgOwner` comes from the org membership role, or from the login for a user account. |
| `builds.list` | query | read | Paginated with `.paginate()`, filters branch, status, build name. |
| `builds.get` | query | read | Build and counts by number. |
| `snapshots.list` | query | read | Paginated sidebar list by `by_buildId_and_diffStatus_and_name`. Includes image URLs from `blobs.getUrl`. |
| `snapshots.get` | query | read | One snapshot with metadata, review info and history. |
| `reviews.apply` | mutation | write | `{ buildId, snapshotIds or "all", action, comment }`. "all" runs in chunks of 1,000 through scheduled mutations; the UI shows progress from `counts`. |
| `baselines.list` | query | read | Paginated snapshots of the newest full approved build on the default branch. |
| `baselines.history` | query | read | Changed rows for one name on the default branch. |
| `projects.updateSettings` | mutation | admin | Partial update. |
| `tokens.list` | query | admin | Tokens that are not revoked: name, created time, last used time. |
| `tokens.create` | action | admin | Generates the token, stores the hash through an internal mutation, returns the token once. |
| `tokens.revoke` | mutation | admin | |
| `projects.delete` | mutation | admin | Marks deleted, schedules chunked deletion. |
| `usage.get` | query | org owner | Usage page data. |

`reviews.apply` on superseded, pending, expired or storage-blocked builds throws a `ConvexError` with code `build_not_reviewable`.

## 9. GitHub integration

GitHub App permissions:

| Permission | Level | Why |
|---|---|---|
| Checks | write | Create and update check runs. |
| Pull requests | read | PR number, base branch, squash merge lookup. |
| Contents | read | Compare API for baseline fallback. |
| Metadata | read | Required by GitHub. |

The app's OAuth settings are also what Convex Auth uses for sign-in (section 6).

Webhooks go to the HTTP action `POST /github/webhook`. It reads the raw body, verifies `X-Hub-Signature-256` with the webhook secret using `crypto.subtle` HMAC, dedupes by delivery id, and hands the event to an internal mutation.

| Event | Action |
|---|---|
| `installation` created, deleted, suspend, unsuspend | Create or archive account and projects. |
| `installation_repositories` added, removed | Create or archive projects. |
| `repository` renamed, transferred, edited | Update owner, name, default branch, private flag. |
| `check_run` rerequested | Re-send the current check state. Does not re-run CI. |
| `pull_request` closed | Set `prClosedAt` on that PR's builds, which starts their retention clock. |

GitHub API calls (check runs, compare, PR lookup) run in actions with an installation token made from the app's private key. Octokit uses Web Crypto and probably runs in the default Convex runtime (unverified); if not, those actions move to a `"use node"` file. Scheduled actions run at most once and are not retried ([docs](https://docs.convex.dev/scheduling/scheduled-functions)), so the check update action records `checkSyncedAt` on the build, and a cron every 5 minutes retries builds whose check is out of date.

Check run content:
- Title from the mapping table in section 3.
- Summary: counts, a link to the build, and up to 10 changed snapshot names as links.
- No annotations in v1.

## 10. CLI

Package `stateofpixel`, closed source, published unminified with source maps. Node 20 or newer. `odiff-bin` as optional dependency, pixelmatch and pngjs bundled.

### Commands

| Command | Purpose |
|---|---|
| `stateofpixel upload <dir>` | Hash, upload, diff, complete a shard. The main command. |
| `stateofpixel finalize` | Finish a build in finalize mode. |
| `stateofpixel storybook <static-dir>` | Capture every story from a built Storybook with Playwright, then upload. |
| `stateofpixel compare <dir> <baseline-dir>` | Local only (M0). Writes `stateofpixel-report/index.html`. |

`upload` flags:

| Flag | Env var | Default |
|---|---|---|
| `--build-name` | `STATEOFPIXEL_BUILD_NAME` | `default` |
| `--shard i/n` or `--shard auto` | `STATEOFPIXEL_SHARD` | `1/1` |
| `--nonce` | `STATEOFPIXEL_NONCE` | CI run id plus attempt |
| `--baseline-branch` | `STATEOFPIXEL_BASELINE_BRANCH` | PR base, else default branch |
| `--baseline-commit` | `STATEOFPIXEL_BASELINE_COMMIT` | computed |
| `--subset` | | off. Use when only some snapshots ran, so missing ones are not `removed`. |
| `--threshold` | | from project settings |
| `--ignore <glob>` | | none |
| `--strict` | | off |
| `--dry-run` | | off. Hash and print the plan, upload nothing. |
| | `STATEOFPIXEL_TOKEN` | OIDC on GitHub Actions |

Snapshot name from a folder upload is the path relative to `<dir>` without `.png`, like `components/Button/primary`.

### Config file

`stateofpixel.config.json` in the repo root, all fields optional:

```json
{
  "buildName": "storybook",
  "threshold": 0.1,
  "ignore": ["**/*.flaky.png"],
  "storybook": {
    "viewports": [375, 1280],
    "browsers": ["chromium"],
    "include": ["components/**"],
    "exclude": ["**/Playground"],
    "waitForSelector": "#storybook-root > *",
    "delay": 0
  }
}
```

### Playwright integration

A reporter plus a helper:

```ts
// playwright.config.ts
reporter: [["list"], ["stateofpixel/playwright"]]

// in a test
import { snapshot } from "stateofpixel/playwright";
await snapshot(page, "Checkout/Empty cart");
```

`snapshot` applies the flakiness defaults (animations disabled, caret hidden, fonts loaded), appends `[browser width]` to the name, saves the PNG and records metadata. The reporter runs the upload once the test run ends, or per shard when Playwright sharding is on.

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

v1 stores every PNG in Convex File Storage. All storage code sits in `packages/backend/convex/blobs.ts`:

| Function | v1 (Convex) | Later (R2) |
|---|---|---|
| `createUploadTargets(hashes)` | `ctx.storage.generateUploadUrl()` per hash | presigned PUT per hash |
| `confirmUpload(hash, ref)` | check `_storage.sha256`, return `storageId` | HEAD the object, check size |
| `getUrl(image)` | `ctx.storage.getUrl(storageId)` | presigned GET or public bucket URL |
| `delete(image)` | `ctx.storage.delete(storageId)` | DELETE the object |

Nothing else in the backend touches `ctx.storage`. Moving to R2 means writing the R2 side of these four, then migrating images in batches and flipping `images.store` per row. A future R2 key layout: `a/{accountId}/img/{hash[0:2]}/{hash}.png`.

Things to know about Convex File Storage URLs ([docs](https://docs.convex.dev/file-storage/serve-files)):
- `getUrl` returns a signed URL, per the Convex guidelines in `packages/backend/convex/_generated/ai/guidelines.md`. Anyone holding the URL can open the image. How long a signed URL stays valid is not stated there (unverified), so treat it as long-lived and never store it; store the `Id<"_storage">` and call `getUrl` on read.
- The open-source Convex backend sends `Cache-Control: private, max-age=2592000` on storage reads (unverified for hosted Convex). Browsers cache images for 30 days, shared CDNs do not. Images never change for a given file, so this is safe.
- Every image view is Convex egress ($0.132/GB on Starter after 1 GB). The review page loads the viewer's images only, and the sidebar shows names, not thumbnails, to keep egress down.

### Crons

In `packages/backend/convex/crons.ts` ([docs](https://docs.convex.dev/scheduling/cron-jobs)). Each cron is a small mutation that does one chunk of work and reschedules itself with `runAfter(0)` until done, so no single function hits the 1 s limit.

| Cron | Schedule | Work |
|---|---|---|
| `expireBuilds` | none, per build | Scheduled at build creation for 60 min later. Sets `expired` if still pending. |
| `syncChecks` | every 5 min | Retries GitHub check updates that did not land. |
| `pruneRows` | daily 03:00 UTC | Row pruning rules from the snapshots table. |
| `deleteOldBuilds` | daily 03:30 UTC | Deletes builds of closed PRs older than `prRetentionDays`, and builds of branches with no activity for that long. |
| `collectImages` | daily 04:00 UTC | Deletes images with no snapshot referencing them (checked through `by_imageId`) and not referenced for 24 hours, and their stored files. |
| `usage` | daily 05:00 UTC | Writes `usageDaily`, sets `accounts.storageBytes`, sets or clears `overLimitSince`. |
| `cleanupEvents` | daily | Deletes `githubEvents` older than 7 days. |

Storage billed is the sum of `images.bytes` per account. Every image counts once, however many builds reference it.

## 12. Limits

| Limit | Value (proposal) | Why |
|---|---|---|
| Snapshots per build | 20,000 | Keeps a 20k manifest near 2 MB. |
| Request body for POST /builds | 16 MB | Convex HTTP actions accept up to 20 MiB. The CLI splits bigger manifests into several calls with the same nonce and shard. |
| Image size | 20 MB | Checked from `_storage.size` at confirm. |
| Image dimensions | 10,000 x 50,000 px | |
| Snapshot name | 512 chars | |
| Metadata per snapshot | 4 KB | |
| Shards per build | 256 | |
| Build timeout | 60 min from creation to finalize | |
| Server chunk size | 1,000 snapshots per query or mutation | 1 s, 4,096 index ranges and 16,000 writes per function ([limits](https://docs.convex.dev/production/state/limits)). |

## 13. Not in v1

- Email or Slack notifications. The GitHub check is the notification.
- Comments threads on snapshots. A single reject comment only.
- Thumbnails. Generating them needs decoding on the server; the browser scales full images instead. Revisit if the Baselines grid is slow.
- Ignore regions drawn in the UI. Masks live in test code.
- Organization-level roles beyond what GitHub gives.
- Wait-for-review in CI (`--wait`), PR comments, flaky detection, billing UI (all M3).
