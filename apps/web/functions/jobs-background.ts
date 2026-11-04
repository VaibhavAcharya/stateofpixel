import "@stateofpixel/backend/api";
import { runDueJobs } from "@stateofpixel/backend/server";

export default async () => {
  await runDueJobs(Date.now() + 14 * 60 * 1000);
};
