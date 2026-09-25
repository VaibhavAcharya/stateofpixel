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
3. The snapshot detail panel shows its history. If the hash alternates between two values across recent builds, it shows "Looks flaky: flipped 3 times in 10 builds" and a link to the docs on masks and thresholds (M3).
4. Fix is in the user's config: raise the threshold for that snapshot, or mask the region.

### 4.10 Storage limit reached

1. Account reaches 80% of its storage limit. Account and project pages show a yellow banner to members with write access. The CLI prints a warning line.
2. At 100%, a 14-day grace period starts and `overLimitSince` is set. Everything keeps working, banner turns red and names the date grace ends.
3. After grace, new builds get `storageBlocked`. They still hash-compare, but `POST /builds` returns no upload URLs for new hashes and no baseline URLs, so the CLI neither uploads nor diffs. Snapshots that match the baseline are `unchanged` as usual. Changed and added snapshots get a row with no image and review state `none`. The build finalizes as `changes`, is never a baseline, cannot be reviewed, and the check is neutral, "Storage limit reached, not compared". CI never fails because of us.
4. Freeing space (shorter retention, deleting projects) or upgrading ends the state as soon as `storageBytes` drops under the limit. Upgrading goes through Dodo Payments (section 8, Billing). `accounts.setPlan` (an internal mutation run from the Convex dashboard) still sets a plan by hand, for example `custom`.

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
| `/brand` | Logo files to download, usage rules, colors and type. |
| `/privacy`, `/terms`, `/refunds` | Legal pages. Support email `hello@stateofpixel.com`. |

Paid plans in the pricing block show "Coming soon" until billing is available (`billing.available`). Upgrading happens only from the plan box on the account home (5.3).

These paths shadow GitHub accounts with the same login. Docs pages are not built yet.

In dev only, `/lab.stateofpixel/web/builds/{1,2}` renders the build page from fixtures for the visual suite (README, Dogfooding). GitHub logins cannot contain a dot, so it never shadows an account.

### 5.2 Install (`/install`)

Shown when the signed-in user has no installations. One button to the GitHub App install screen. Below it: "Already installed? Refresh" for when the webhook is slow.

### 5.3 Account home (`/{owner}`)

```
+--------------------------------------------------------------+
| stateofpixel      acme v                         [avatar]    |
+--------------------------------------------------------------+
| Projects                                 Storage 3.1 / 10 GB |
|                                                              |
| web-app        #412  main   no changes     2 min ago         |
| design-system  #88   feat/x 12 to review   1 h ago           |
| marketing      no builds yet                                 |
|                                                              |
| Missing a repo? Configure access on GitHub                   |
+--------------------------------------------------------------+
```

- Account switcher for users in several orgs. Each account shows its plan in muted text. When billing is available and the current account has no subscription, the menu has an "Upgrade plan" item that links to the plan box.
- One row per project: name, latest build number, branch, conclusion pill, relative time.
- Storage meter links to the Usage page (owners only; others see no meter). It ships with the Usage page (M3).
- Storage banner from 80% of the limit (4.10). The same banner shows on project pages to users with write access. When billing is available it links to the plan box ("upgrade the plan"); otherwise it points to the support email.
- "Configure access on GitHub" links to the installation settings.
- Plan box above the projects: plan name and storage used. When billing is available, it shows an Upgrade menu (paid plans, monthly and yearly) while the account has no subscription, and Manage billing once it has a billing customer. Both buttons show to every member; the actions check for an owner and the box shows the error.
- Checkout returns to `/{owner}?subscription_id=...&status=...`. The status is a hint from Dodo, never proof of payment, so the plan box only says what happens next: "Payment received. Your plan updates in a few seconds." until the webhook makes that subscription active, then "Payment received. You are on the 25 GB plan."; "Your payment is processing" for `pending`; and for any other status, "The payment did not go through, so your plan did not change." The notice can be dismissed, which removes the query.
- When a renewal fails (`on_hold` or `past_due`), the plan box says "Your last payment failed" and points to Manage billing. The plan stays until Dodo cancels the subscription.

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
- History: last 10 builds on the baseline branch where this snapshot's hash changed, as links. Ships with snapshot history (M2).
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
| Checks | Check name | `stateofpixel` | With several build names: `stateofpixel / {build name}`. |
| Retention | Keep PR-only images for | 60 days | 7 to 365. Showing the storage this setting uses comes with the usage page. |
| Tokens | Project tokens | none | Create, name, last used time, revoke. Token shown once. |
| Danger | Delete project | | Type the repo name to confirm. Deletes the project row right away and its builds, snapshots, reviews, approvals and tokens in chunks. A repository still in the installation comes back as an empty project on the next sync. |

Every change is saved on blur with a small "Saved" note. No save button.

### 5.9 Usage and billing (`/{owner}/settings/usage`, org owner only)

- Big number: storage used and limit, like `3.1 GB of 10 GB`.
- Split: baselines vs PR-only images vs diff images.
- Table per project: storage, share of total, retention setting, link to its settings.
- Chart: daily storage for the last 90 days, from `usageDaily`.
- Plan box: current plan (Free, 25 GB, 100 GB or 500 GB), billing period, payment method, invoices (M3).

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
| githubCheckRunId | number, optional | |
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
| bytes | number | From `_storage.size`, not from the client. |
| width, height | number | Sent by the client, not checked. |
| store | `"convex"` or `"r2"` | Which store holds the bytes. Only `"convex"` in v1. |
| storageId | Id<"_storage">, optional | Set when `store` is `"convex"` and the upload is confirmed. |
| r2Key | string, optional | For later. |
| lastReferencedAt | number | Set at confirm. `createUploadTargets` moves it forward when a build reuses the image and it is over 12 hours old, so `collectImages` never deletes an image a pending build relies on. |

Index `by_accountId_and_hash` on `[accountId, hash]`, unique by code. The same PNG in two accounts is stored twice. Index `by_storageId` lets a confirm check that no image row already uses a `storageId`.

An image row is created only after an upload is confirmed (see 7.3), so there is no "pending upload" state to clean up in this table.

### usageDaily

| Field | Type | Notes |
|---|---|---|
| accountId | Id<"accounts"> | |
| projectId | Id<"projects"> | |
| day | string | `YYYY-MM-DD`, UTC. Indexes `by_projectId_and_day` and `by_accountId_and_day`. |
| baselineBytes, prBytes, diffBytes | number | Computed by the daily cron. |
| builds, snapshots, uploadedImages | number | For our own dashboards, not billing. |

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
5. Baseline URLs from `blobs.getUrl` for changed names.

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

Returns status, conclusion, counts, URL and `shards: { done, total }`. The CLI uses it for `--wait` (M3).

### 7.6 Baseline selection

In one internal query:
1. For each SHA in `ancestors`, newest first, look up `by_projectId_and_buildName_and_commitSha` for this build name.
2. Take the first build that is finalized, has conclusion `approved` or `no_changes`, and has `fullRows`.
3. If none matches (shallow checkout, or a branch older than the 90-day full-row window), the `POST /builds` action asks the GitHub compare API (`GET /repos/{owner}/{repo}/compare/{base}...{head}`, status `ahead` or `identical`) whether the newest 5 candidate builds on the baseline branch are ancestors of the head commit, and takes the newest one that is. It runs before the create mutation and only when the nonce has no build yet, so shards that join do not call GitHub.
4. If still none, the build is an orphan. On a PR this shows a banner: "No baseline found for this branch. Rebase on main to compare."

### 7.7 Errors

`{ "error": { "code": "too_many_snapshots", "message": "..." } }` with HTTP status. The CLI prints the message and exits 1 for 4xx caused by config, and exits 0 with a warning for 5xx (proposal: our outage should not break their CI). A 429 from a rate limit is handled the same way: the CLI prints the message and exits 0. `--strict` makes 5xx and 429 exit 1. HTTP actions are not retried by Convex, so the CLI retries 5xx and network errors 3 times with backoff; every endpoint is idempotent by nonce, shard index and hash.

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
| `projects.access` | query | signed in | Project id, cached permission, whether it is fresh, `canRead` and `canWrite`, and the account's storage usage when the user can write. The page calls `permissions.refresh` while it is not fresh. |
| `accounts.home` | query | account member | The account, its installation settings URL, its storage usage (plan, bytes, limit, `overLimitSince`), its subscription id and status, and whether it has a billing customer. The page works out the storage state with the clock, since queries do not read it. |
| `accounts.setPlan` | internal mutation | Convex dashboard or `npx convex run` | Sets `plan` and `storageLimitBytes`. A `custom` plan takes the limit as an argument. For plans set by hand; paid plans come from billing. |
| `accounts.projects` | query | account member | Paginated projects with their latest build, searchable, sorted by name or last build. |
| `builds.list` | query | read | Paginated with `.paginate()`, filters branch, pull request and a list of states. |
| `builds.get` | query | read | Build and counts by number. |
| `snapshots.list` | query | read | Paginated sidebar list by `by_buildId_and_diffStatus_and_name`: name, statuses and diff ratio, no image URLs. |
| `snapshots.get` | query | read | One snapshot with metadata, review info and history. |
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
| `usage.get` | query | org owner | Usage page data. Not built yet. |
| `billing.available` | query | anyone | Whether this deployment has a Dodo API key. |
| `billing.checkout` | action | org owner | `{ login, plan, interval }`. Returns a Dodo Payments checkout URL for a paid plan, monthly or yearly. Throws `already_subscribed` when the account has a subscription. |
| `billing.portal` | action | org owner | Returns a Dodo Payments customer portal link for payment method, invoices and cancelling. Throws `not_subscribed` without a customer. |

`reviews.apply` on superseded, pending, expired or storage-blocked builds throws a `ConvexError` with code `build_not_reviewable`. `approve` and `reject` apply to snapshots with review state `pending`, `approved` or `rejected`; `undo` sets them back to `pending` and removes the `approvedImages` rows of that image on the PR. `"all"` only touches `pending` snapshots, runs 500 per scheduled mutation (changed first, then added), and cannot undo. Every call recomputes the conclusion and bumps the GitHub check.

### Billing

Paid plans are Dodo Payments subscriptions, one product per plan and interval. The product ids per environment are in `convex/lib/billing.ts`. For a user account the owner is the user; for an org it is an org owner, checked against GitHub like `permissions.refresh`. Checkout puts the account id in the subscription metadata and returns to `/{owner}`.

Dodo sends subscription events to the HTTP action `POST /dodo/webhook`. It verifies the Standard Webhooks signature with `DODO_PAYMENTS_WEBHOOK_SECRET` and reads the subscription in the payload, which is its latest state, so order and duplicates do not matter:

| Subscription status | Action |
|---|---|
| `active` | Set the plan of its product, `billingCustomerId`, `billingSubscriptionId` and `billingStatus`. |
| `cancelled`, `expired`, `failed` | If it is the account's `billingSubscriptionId`, move to `free` and clear it. |
| other (`on_hold`, `past_due`, `paused`, `pending`) | If it is the account's `billingSubscriptionId`, set `billingStatus`. The plan stays. |

The customer portal offers two ways to cancel. "Cancel now" ends the subscription at once, so the account moves to `free` on that event. "Cancel at next billing date" keeps the subscription `active` with `cancel_at_next_billing_date` until the period ends, so the plan stays until then; the plan box does not show that date yet.

Moving to `free` can put the account over its limit, which starts the grace period of section 4.10.

## 9. GitHub integration

GitHub App permissions:

| Permission | Level | Why |
|---|---|---|
| Checks | write | Create and update check runs. |
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
| `check_run` rerequested | Re-send the current check state. Does not re-run CI. |
| `pull_request` closed, reopened | Set or clear `prClosedAt` on that PR's builds. Closing starts their retention clock. The GitHub App must subscribe to the Pull request event. |

GitHub API calls (check runs, compare, PR lookup) run in actions with an installation token made from the app's private key. Octokit uses Web Crypto and probably runs in the default Convex runtime (unverified); if not, those actions move to a `"use node"` file. Scheduled actions run at most once and are not retried ([docs](https://docs.convex.dev/scheduling/scheduled-functions)), so every state change bumps `checkVersion` and schedules `checks.sync` unless one is already scheduled. The sync creates the check run (`external_id` is the build id) or updates it, then clears `checkOutOfSync` only when the version it sent is still current; otherwise it runs again. A cron every 5 minutes retries builds that are still out of sync. A 422 from GitHub, for example for a commit GitHub does not have, is not retried. The check name is `stateofpixel`, or `stateofpixel/<buildName>` for other build names, on the build's head commit.

Check run content:
- Title from the mapping table in section 3.
- Summary: a counts table, a link to the build, and up to 10 changed or added snapshot names linking to `/builds/{number}/snapshots/{id}`.
- No annotations in v1.

## 10. CLI

Package `stateofpixel`, closed source, published unminified with source maps. Node 20 or newer. `odiff-bin` as optional dependency, pixelmatch and pngjs bundled.

### Commands

| Command | Purpose |
|---|---|
| `stateofpixel upload <dir>` | Hash, upload, diff, complete a shard. The main command. |
| `stateofpixel finalize` | Finish a build in finalize mode. |
| `stateofpixel storybook <static-dir>` | Capture every story from a built Storybook with Playwright, then upload. Takes the `upload` flags plus `--viewports` (default `1280`), `--include` and `--exclude` globs on `title/name`, `--wait-for-selector` (default `#storybook-root > *`) and `--delay`. |
| `stateofpixel compare <dir> <baseline-dir>` | Local only (M0). Writes `stateofpixel-report/index.html`. |

`upload` flags:

| Flag | Env var | Default |
|---|---|---|
| `--build-name` | `STATEOFPIXEL_BUILD_NAME` | `default` |
| `--shard i/n` or `--shard auto` | `STATEOFPIXEL_SHARD` | `1/1` |
| `--nonce` | `STATEOFPIXEL_NONCE` | CI run id plus attempt |
| `--baseline-branch` | `STATEOFPIXEL_BASELINE_BRANCH` | PR base, else default branch |
| `--subset` | | off. Use when only some snapshots ran, so missing ones are not `removed`. |
| `--threshold` | | from project settings |
| `--strict` | | off. Exit 1 on 5xx and rate limits (429) instead of warning and exiting 0. |
| `--dry-run` | | off. Hash and print the plan, upload nothing. |
| | `STATEOFPIXEL_TOKEN` | OIDC on GitHub Actions |

Snapshot name from a folder upload is the path relative to `<dir>` without `.png`, like `components/Button/primary`.

`finalize` takes `--build-name`, `--nonce`, `--baseline-branch`, `--skip-if-empty` and `--strict`. A `<name>.meta.json` file next to `<name>.png` is sent as that snapshot's metadata. Git info comes from the GitHub Actions env and event payload (the PR head SHA, not the merge SHA) and from local git; `ancestors` is `git rev-list` of the commit, or of `HEAD` without the merge commit when the PR head is not in a shallow checkout. The API base URL is `STATEOFPIXEL_API_URL`, default `https://graceful-dogfish-423.convex.site/api/v1` until a custom domain exists.

### Playwright integration

A reporter plus a `snapshot(page, name)` helper, with setup in `packages/cli/README.md`. `snapshot` applies the flakiness defaults (animations disabled, caret hidden, fonts loaded), appends `[browser width]` to the name, saves a full-page PNG into `stateofpixel-screenshots` (or `STATEOFPIXEL_DIR`) and writes metadata next to it. The reporter clears that folder when the run begins and uploads it once the run ends, per shard when Playwright sharding is on. It uploads only when `CI` is set, unless the reporter option `uploadOutsideCi` is true, and marks the upload as a subset when the run did not pass. Reporter options: `buildName`, `nonce`, `baselineBranch`, `subset`, `threshold`, `strict`, `uploadOutsideCi`. Storybook captures and the Playwright helper use the Playwright the project installs, an optional peer dependency.

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
| `syncChecks` | every 5 min | Retries GitHub check updates that did not land. |
| `deleteOldBuilds` | daily 03:30 UTC | Deletes builds of PRs closed longer than `prRetentionDays` ago, and builds of branches with no new build for that long. Never deletes pending builds, builds on the default branch or an auto-approve branch, or a build that another build uses as its baseline. Deletes the build row first, then its snapshots and reviews in chunks, then the PR's `approvedImages` once no build of that PR is left. |
| `collectImages` | daily 04:00 UTC | Deletes images with no snapshot referencing them (checked through `by_imageId`, `by_baselineImageId` and `by_diffImageId`) and `lastReferencedAt` over 24 hours ago, and their stored files. Subtracts the bytes from `accounts.storageBytes`. |
| `cleanupEvents` | daily 04:30 UTC | Deletes `githubEvents` older than 7 days. |

Not built yet: `pruneRows` (daily 03:00 UTC) applies the row pruning rules from the snapshots table, and `usage` (daily 05:00 UTC) writes `usageDaily`. `accounts.storageBytes` and `overLimitSince` are kept current by upload confirm and `collectImages`. Build expiry is not a cron: `builds.expire` is scheduled per build, 60 minutes after creation, and sets `expired` if the build is still pending.

Storage billed is the sum of `images.bytes` per account. Every image counts once, however many builds reference it.

## 12. Limits

The CI API enforces these. A request over a limit gets a 4xx with the codes in brackets, and an image over the size or dimension limit comes back in `rejectedUploads`.

| Limit | Value | Why |
|---|---|---|
| Snapshots per build | 20,000 (`too_many_snapshots`) | Keeps a 20k manifest near 2 MB. |
| Request body for every CI call | 16 MB (`body_too_large`) | Convex HTTP actions accept up to 20 MiB. The CLI splits bigger manifests into several calls with the same nonce and shard. |
| Image size | 20 MB | Checked from `_storage.size` at confirm. |
| Image dimensions | 10,000 x 50,000 px | |
| Snapshot name | 512 chars (`snapshot_name_too_long`) | |
| Metadata per snapshot | 4 KB (`metadata_too_large`) | |
| Shards per build | 256 (`invalid_shard`, `too_many_shards` for auto shards) | |
| Build timeout | 60 min from creation to finalize | |
| Requests per token | 600 a minute (`rate_limited`, 429) | Token bucket keyed by project token, or by project for OIDC. |
| Builds per account | 2,000 a day (`build_limit_reached`, 429) | Counted when a build is created, not when a shard joins. |
| Bytes uploaded per account | 20 GB a day (`upload_limit_reached`, 429) | Counted at upload confirm. New builds are refused once the day's bytes are used. |
| Server chunk size | 1,000 snapshots per query or mutation | 1 s, 4,096 index ranges and 16,000 writes per function ([limits](https://docs.convex.dev/production/state/limits)). |

## 13. Not in v1

- Email or Slack notifications. The GitHub check is the notification.
- Comments threads on snapshots. A single reject comment only.
- Thumbnails. Generating them needs decoding on the server; the browser scales full images instead. Revisit if the Baselines grid is slow.
- Ignore regions drawn in the UI. Masks live in test code.
- Organization-level roles beyond what GitHub gives.
- Wait-for-review in CI (`--wait`). PR comments, flaky detection and billing are tracked in ROADMAP.md.
