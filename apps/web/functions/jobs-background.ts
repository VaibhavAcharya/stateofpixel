import { runDueJobs } from "@stateofpixel/backend/server";
import { withBackend } from "../src/server/backend";

export default async (request: Request) => {
  withBackend(request.url);
  await runDueJobs(Date.now() + 14 * 60 * 1000);
};
