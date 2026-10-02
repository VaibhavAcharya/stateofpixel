# Roadmap

Follow-ups from the move to Netlify Database, Functions and Identity.

## Faster updates

- Find why the web job that finishes a main build waits about 30 seconds in the upload. It happened on the pushes of 7d39e14 (34.4 s) and e56833c (33.7 s); the other shard of the same runs took about 2 seconds.
- The first upload after a production deploy takes 9 to 12 seconds, and a server function invocation right after a deploy took about 7 seconds. The database sleeps after 5 minutes without queries, and turning that off needs a Pro plan. Check how much of the delay is the database waking up and how much is the server function starting.

## Jobs

- Retry failed action jobs with a backoff, like the blob delete retries.
- Show failed jobs somewhere, and clean up old failed rows.
- Recover a crashed job sooner than the 15 minute lock.
- Run due jobs in deploy previews, where scheduled functions do not run.

## Onboarding

- Add "Disconnect GitHub" and "Delete account" to the user menu. Today both go through email.

## Data

- Find why some snapshots of older builds point at images that no longer exist, and stop the image cleanup from deleting images still in use.
- Raise the 4 MB image limit by uploading straight to Blobs instead of through a function.

## Landing and marketing

- Mention on the landing that GitHub tokens are stored encrypted and private image links expire within two hours.

## Local development

- Make `netlify database migrations apply` and `netlify dev` use the same local database in this monorepo.
