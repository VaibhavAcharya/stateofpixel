# Roadmap

Follow-ups from the move to Netlify Database, Functions and Identity.

## Faster updates

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
- Enable Google sign-in in Identity.

## Data

- Find why some snapshots of older builds point at images that no longer exist, and stop the image cleanup from deleting images still in use.
- Raise the 4 MB image limit by uploading straight to Blobs instead of through a function.

## Local development

- Make `netlify database migrations apply` and `netlify dev` use the same local database in this monorepo.
- Stop a local `pnpm build` from replacing the dev server under `netlify dev`.

## Clean up after the move

- Remove the forwarding proxy for the old API host once CI runs use CLI 1.7 or newer.
- Remove the one-off data import script in `packages/backend/scripts` after the import.
