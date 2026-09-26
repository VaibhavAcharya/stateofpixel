import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import {
  CI_REQUESTS_PER_MINUTE,
  DAILY_BUILDS,
  DAILY_UPLOAD_BYTES,
} from "./lib/limits";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  ciRequests: {
    kind: "token bucket",
    rate: CI_REQUESTS_PER_MINUTE,
    period: MINUTE,
  },
  builds: { kind: "fixed window", rate: DAILY_BUILDS, period: DAY },
  uploadedBytes: {
    kind: "fixed window",
    rate: DAILY_UPLOAD_BYTES,
    period: DAY,
  },
});
