import { DAY, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const DAILY_BUILDS = 2000;
export const DAILY_UPLOAD_BYTES = 20 * 1024 ** 3;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  ciRequests: { kind: "token bucket", rate: 600, period: MINUTE },
  builds: { kind: "fixed window", rate: DAILY_BUILDS, period: DAY },
  uploadedBytes: {
    kind: "fixed window",
    rate: DAILY_UPLOAD_BYTES,
    period: DAY,
  },
});
