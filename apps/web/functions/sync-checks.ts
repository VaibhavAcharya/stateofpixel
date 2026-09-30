import { internal } from "@stateofpixel/backend/api";
import { env } from "@stateofpixel/backend/env";
import { schedule } from "@stateofpixel/backend/server";
import { withBackend } from "../src/server/backend";

export default async () => {
  withBackend(env.SITE_URL);
  await schedule(internal.checks.retryOutOfSync, {});
};
