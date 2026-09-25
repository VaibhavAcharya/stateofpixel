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

export type Access = {
  userId: Id<"users"> | null;
  permission: RepoPermission | null;
  fresh: boolean;
};

export async function readAccess(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Access> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return { userId, permission: null, fresh: false };
  }
  const row = await ctx.db
    .query("repoPermissions")
    .withIndex("by_userId_and_projectId", (q) =>
      q.eq("userId", userId).eq("projectId", projectId),
    )
    .unique();
  return {
    userId,
    permission: row?.permission ?? null,
    fresh: row !== null && Date.now() - row.checkedAt <= PERMISSION_TTL_MS,
  };
}

export function allows(
  project: Doc<"projects">,
  access: Access,
  needed: Exclude<RepoPermission, "none">,
): boolean {
  if (needed === "read" && !project.private) {
    return true;
  }
  return (
    access.fresh &&
    access.permission !== null &&
    RANK[access.permission] >= RANK[needed]
  );
}

export async function requirePermission(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  needed: Exclude<RepoPermission, "none">,
): Promise<{ userId: Id<"users"> | null; project: Doc<"projects"> }> {
  const project = await ctx.db.get("projects", projectId);
  if (project === null) {
    throw new ConvexError({ code: "not_found" });
  }
  const access = await readAccess(ctx, projectId);
  if (allows(project, access, needed)) {
    return { userId: access.userId, project };
  }
  if (access.userId === null) {
    throw new ConvexError({ code: "not_signed_in" });
  }
  if (!access.fresh) {
    throw new ConvexError({ code: "permission_unknown" });
  }
  throw new ConvexError({
    code:
      access.permission === "none" || access.permission === null
        ? "not_found"
        : "forbidden",
  });
}
