import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { findAllowedProject, requirePermission } from "./lib/permissions";
import { generateProjectToken, hashProjectToken } from "./lib/projectTokens";

const MAX_TOKENS = 100;
const MAX_NAME_LENGTH = 100;

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        id: v.id("projectTokens"),
        name: v.string(),
        createdAt: v.number(),
        lastUsedAt: v.union(v.number(), v.null()),
      }),
    ),
  ),
  handler: async (ctx, { projectId }) => {
    if ((await findAllowedProject(ctx, projectId, "admin")) === null) {
      return null;
    }
    const tokens = await ctx.db
      .query("projectTokens")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(MAX_TOKENS);
    return tokens
      .filter((token) => token.revokedAt === undefined)
      .map((token) => ({
        id: token._id,
        name: token.name,
        createdAt: token._creationTime,
        lastUsedAt: token.lastUsedAt ?? null,
      }));
  },
});

export const create = action({
  args: { projectId: v.id("projects"), name: v.string() },
  returns: v.string(),
  handler: async (ctx, { projectId, name }) => {
    const token = generateProjectToken();
    await ctx.runMutation(internal.tokens.insert, {
      projectId,
      name,
      tokenHash: await hashProjectToken(token),
    });
    return token;
  },
});

export const insert = internalMutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    tokenHash: v.string(),
  },
  returns: v.id("projectTokens"),
  handler: async (ctx, { projectId, name, tokenHash }) => {
    const { userId } = await requirePermission(ctx, projectId, "admin");
    if (userId === null) {
      throw new ConvexError({ code: "not_signed_in" });
    }
    const trimmedName = name.trim();
    if (trimmedName === "" || trimmedName.length > MAX_NAME_LENGTH) {
      throw new ConvexError({ code: "invalid_name" });
    }
    return ctx.db.insert("projectTokens", {
      projectId,
      name: trimmedName,
      tokenHash,
      createdBy: userId,
    });
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("projectTokens") },
  returns: v.null(),
  handler: async (ctx, { tokenId }) => {
    const token = await ctx.db.get("projectTokens", tokenId);
    if (token === null) {
      throw new ConvexError({ code: "not_found" });
    }
    await requirePermission(ctx, token.projectId, "admin");
    if (token.revokedAt === undefined) {
      await ctx.db.patch("projectTokens", tokenId, { revokedAt: Date.now() });
    }
    return null;
  },
});
