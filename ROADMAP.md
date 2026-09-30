# Roadmap

Follow-ups from the move to Netlify Database, Functions and Identity.

## Faster updates

- Find what slows CI uploads since the move. The `playground` upload step went from 1 to 2 seconds to up to 22 seconds, and the server function's p99 is about 7 seconds. Log route, duration and query count per request, then batch the query loops in the upload and finalize paths and look at cold starts.
- Poll faster while a build is pending or a review is open, and slower on idle pages. Pages refresh every 5 seconds today.
- Batch the queries of one page into one `/api/rpc` request.
- Cache the Identity user for a request instead of calling `/.netlify/identity/user` on every RPC.

## Jobs

- Retry failed action jobs with a backoff, like the blob delete retries.
- Show failed jobs somewhere, and clean up old failed rows.
- Recover a crashed job sooner than the 15 minute lock.
- Run due jobs in deploy previews, where scheduled functions do not run.

## Onboarding

- Check whether connecting GitHub after signing in with GitHub skips the second consent screen, and skip the Connect GitHub screen when it can.
- Add "Disconnect GitHub" and "Delete account" to the user menu. Today both go through email.

## Data

- Find why some snapshots of older builds point at images that no longer exist, and stop the image cleanup from deleting images still in use.
- Raise the 4 MB image limit by uploading straight to Blobs instead of through a function.

## Landing and marketing

- Re-measure the median upload on the landing page from `visual.yml` runs after the speed work, or hide it until then. Its data predates the move.
- Say in the FAQ whether self-hosting is supported.
- Mention on the landing that GitHub tokens are stored encrypted and private image links expire within two hours.

## Local development

- Make `netlify database migrations apply` and `netlify dev` use the same local database in this monorepo.
- Stop a local `pnpm build` from replacing the dev server under `netlify dev`.

## Review

- Hide builds of closed pull requests from the needs-review list, or label them PR closed, until retention deletes them.

## Clean up after the move

- Remove the forwarding proxy for the old API host once CI runs use CLI 1.7 or newer.
- Remove the one-off data import script in `packages/backend/scripts` after the import.
- Add upgrade notes to the CLI 1.7.0 release: the new default API address and the 4 MB image limit.
