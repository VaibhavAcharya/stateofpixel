import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "syncChecks",
  { minutes: 5 },
  internal.checks.retryOutOfSync,
  {},
);

export default crons;
