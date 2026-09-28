import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      login: v.string(),
      name: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }
    return {
      login: user.login,
      name: user.name ?? null,
      image: user.image ?? null,
    };
  },
});
