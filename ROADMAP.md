# Roadmap

Follow-ups from the move to Netlify Database, Functions and Identity.

## Faster updates

- Find why the web job that finishes a main build waits about 30 seconds in the upload. It happened on the pushes of 7d39e14 (34.4 s) and e56833c (33.7 s); the other shard of the same runs took about 2 seconds.
- The first upload after a production deploy takes 9 to 12 seconds, and a server function invocation right after a deploy took about 7 seconds. The database stays awake, because `jobs-tick` queries it every minute and those idle runs take 20 to 45 ms. Check how much of the delay is the server function starting and how much is its first database connection.

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

## Landing

- Mention on the landing that GitHub tokens are stored encrypted and private image links expire within two hours.

## Directories

- Listed in [awesome-regression-testing](https://github.com/mojoaxel/awesome-regression-testing), under Online services, merged in [#120](https://github.com/mojoaxel/awesome-regression-testing/pull/120).
- Listed in [free-for-dev](https://github.com/ripienaar/free-for-dev), under Testing, merged in [#4940](https://github.com/ripienaar/free-for-dev/pull/4940).
- Submitted to [awesome-testing-tools](https://github.com/ZoranPandovski/awesome-testing-tools), under Automated Testing Tools, in [#163](https://github.com/ZoranPandovski/awesome-testing-tools/pull/163).
- Submitted to [awesome-design-systems](https://github.com/klaufel/awesome-design-systems), under Testing, Unit & Regression test, in [#43](https://github.com/klaufel/awesome-design-systems/pull/43).
- Submitted to [awesome-test-automation](https://github.com/atinfo/awesome-test-automation), in `automation-and-testing-as-service.md` under Web test automation and testing, in [#606](https://github.com/atinfo/awesome-test-automation/pull/606).
- Submit to [llms-txt-hub](https://github.com/thedaviddias/llms-txt-hub), under Developer tools, with `/llms.txt` and `/llms-full.txt`.
- Submit to [awesome-storybook](https://github.com/lauthieb/awesome-storybook), under Community resources.
- Submit to [awesome-testing](https://github.com/TheJambo/awesome-testing) under Visual Testing and [awesome-playwright](https://github.com/mxschmitt/awesome-playwright) under Integrations.
- Submit to [OpenAlternative](https://openalternative.co/alternatives/chromatic) under Visual testing, as an alternative to Chromatic and Percy. It lists repositories with 10 or more stars.
- Submit to [awesome-oss-alternatives](https://github.com/RunaCapital/awesome-oss-alternatives), which lists repositories with 100 or more stars.
- Submit to [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted-data), which lists software whose first release is more than four months old, from February 2027.
- Submit to [awesome-developer-first](https://github.com/agamm/awesome-developer-first) under Testing, which lists tools with 1,000 stars, a Product Hunt award or SOC 2.

## Local development

- Make `netlify database migrations apply` and `netlify dev` use the same local database in this monorepo.
