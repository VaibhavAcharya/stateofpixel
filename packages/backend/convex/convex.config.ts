import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    GITHUB_APP_ID: v.string(),
    GITHUB_APP_SLUG: v.string(),
    GITHUB_APP_PRIVATE_KEY: v.string(),
    GITHUB_WEBHOOK_SECRET: v.string(),
  },
});
