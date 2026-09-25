import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    GITHUB_APP_ID: v.string(),
    GITHUB_APP_SLUG: v.string(),
    GITHUB_APP_PRIVATE_KEY: v.string(),
    GITHUB_WEBHOOK_SECRET: v.string(),
    SITE_URL: v.string(),
    DODO_PAYMENTS_API_KEY: v.optional(v.string()),
    DODO_PAYMENTS_WEBHOOK_SECRET: v.optional(v.string()),
    DODO_PAYMENTS_ENVIRONMENT: v.optional(
      v.union(v.literal("test_mode"), v.literal("live_mode")),
    ),
  },
});
app.use(rateLimiter);

export default app;
