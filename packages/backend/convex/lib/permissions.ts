import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { repoPermission } from "../schema";

export type RepoPermission = Infer<typeof repoPermission>;

export const PERMISSION_TTL_MS = 5 * 60 * 1000;

const RANK: Record<RepoPermission, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

export async function requirePermission(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  needed: Exclude<RepoPermission, "none">,
): Promise<{ userId: Id<"users">; project: Doc<"projects"> }> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ code: "not_signed_in" });
  }
  const project = await ctx.db.get("projects", projectId);
  if (project === null) {
    throw new ConvexError({ code: "not_found" });
  }
  const row = await ctx.db
    .query("repoPermissions")
    .withIndex("by_userId_and_projectId", (q) =>
      q.eq("userId", userId).eq("projectId", projectId),
    )
    .unique();
  if (row === null || Date.now() - row.checkedAt > PERMISSION_TTL_MS) {
    throw new ConvexError({ code: "permission_unknown" });
  }
  if (RANK[row.permission] < RANK[needed]) {
    throw new ConvexError({
      code: row.permission === "none" ? "not_found" : "forbidden",
    });
  }
  return { userId, project };
}
