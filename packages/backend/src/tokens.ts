import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first, one } from "./db/index.ts";
import { findAllowedProject, requirePermission } from "./lib/permissions.ts";
import { generateProjectToken, hashProjectToken } from "./lib/projectTokens.ts";
import { projectTokens } from "./schema.ts";
import {
  AppError,
  action,
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./server.ts";

const MAX_TOKENS = 100;
const MAX_NAME_LENGTH = 100;

export const list = query({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    if ((await findAllowedProject(ctx, projectId, "admin")) === null) {
      return null;
    }
    const tokens = await activeTokens(ctx, projectId);
    return tokens.map((token) => ({
      id: token._id,
      name: token.name,
      createdAt: token._creationTime,
      lastUsedAt: token.lastUsedAt,
    }));
  },
});

export const create = action({
  args: { projectId: z.string(), name: z.string() },
  handler: async (ctx, { projectId, name }): Promise<string> => {
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
    projectId: z.string(),
    name: z.string(),
    tokenHash: z.string(),
  },
  handler: async (ctx, { projectId, name, tokenHash }) => {
    const { userId } = await requirePermission(ctx, projectId, "admin");
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const trimmedName = name.trim();
    if (trimmedName === "" || trimmedName.length > MAX_NAME_LENGTH) {
      throw new AppError({ code: "invalid_name" });
    }
    if ((await activeTokens(ctx, projectId)).length >= MAX_TOKENS) {
      throw new AppError({ code: "too_many_tokens" });
    }
    const token = one(
      await ctx.db
        .insert(projectTokens)
        .values({
          projectId,
          name: trimmedName,
          tokenHash,
          createdBy: userId,
        })
        .returning({ _id: projectTokens._id }),
    );
    return token._id;
  },
});

async function activeTokens(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projectTokens">[]> {
  return ctx.db
    .select()
    .from(projectTokens)
    .where(
      and(
        eq(projectTokens.projectId, projectId),
        isNull(projectTokens.revokedAt),
      ),
    )
    .orderBy(asc(projectTokens._creationTime))
    .limit(MAX_TOKENS);
}

export const revoke = mutation({
  args: { tokenId: z.string() },
  handler: async (ctx, { tokenId }) => {
    const token = first(
      await ctx.db
        .select()
        .from(projectTokens)
        .where(eq(projectTokens._id, tokenId)),
    );
    if (token === null) {
      throw new AppError({ code: "not_found" });
    }
    await requirePermission(ctx, token.projectId, "admin");
    if (token.revokedAt === null) {
      await ctx.db
        .update(projectTokens)
        .set({ revokedAt: Date.now() })
        .where(eq(projectTokens._id, tokenId));
    }
    return null;
  },
});
