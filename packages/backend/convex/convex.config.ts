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
  },
});
app.use(rateLimiter);

export default app;
