import type { Config } from "@netlify/functions";
import { env } from "@stateofpixel/backend/env";
import { kickWorker } from "../../src/server/backend";

export default async () => {
  await kickWorker(env.SITE_URL);
};

export const config: Config = { schedule: "* * * * *" };
