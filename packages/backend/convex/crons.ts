import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "syncChecks",
  { minutes: 5 },
  internal.checks.retryOutOfSync,
  {},
);

crons.cron(
  "deleteOldBuilds",
  "30 3 * * *",
  internal.retention.deleteOldBuilds,
  {},
);

crons.cron("collectImages", "0 4 * * *", internal.retention.collectImages, {});

crons.cron("cleanupEvents", "30 4 * * *", internal.retention.cleanupEvents, {});

export default crons;
