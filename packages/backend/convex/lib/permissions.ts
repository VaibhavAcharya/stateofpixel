import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { repoPermission } from "../schema";

export type RepoPermission = Infer<typeof repoPermission>;

export const PERMISSION_STALE_AFTER_MS = 5 * 60 * 1000;
export const PERMISSION_EXPIRED_AFTER_MS = 15 * 60 * 1000;

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
  usable: boolean;
};

export async function readAccess(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Access> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return { userId, permission: null, fresh: false, usable: false };
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
    fresh: row?.freshness === "fresh",
    usable: row?.freshness === "fresh" || row?.freshness === "stale",
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
    access.usable &&
    access.permission !== null &&
    RANK[access.permission] >= RANK[needed]
  );
}

export async function findProject(
  ctx: QueryCtx,
  owner: string,
  name: string,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_owner_and_name", (q) =>
      q.eq("owner", owner).eq("name", name),
    )
    .first();
  return project === null || project.archivedAt !== undefined ? null : project;
}

export async function findReadableProject(
  ctx: QueryCtx,
  owner: string,
  name: string,
): Promise<Doc<"projects"> | null> {
  const project = await findProject(ctx, owner, name);
  if (project === null) {
    return null;
  }
  const access = await readAccess(ctx, project._id);
  return allows(project, access, "read") ? project : null;
}

export async function findAllowedProject(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  needed: Exclude<RepoPermission, "none">,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db.get("projects", projectId);
  if (project === null) {
    return null;
  }
  const access = await readAccess(ctx, projectId);
  return allows(project, access, needed) ? project : null;
}

export async function findReadableBuild(
  ctx: QueryCtx,
  { owner, name, number }: { owner: string; name: string; number: number },
): Promise<Doc<"builds"> | null> {
  const project = await findReadableProject(ctx, owner, name);
  if (project === null) {
    return null;
  }
  return await ctx.db
    .query("builds")
    .withIndex("by_projectId_and_number", (q) =>
      q.eq("projectId", project._id).eq("number", number),
    )
    .unique();
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
  if (!access.usable) {
    throw new ConvexError({ code: "permission_unknown" });
  }
  throw new ConvexError({
    code:
      access.permission === "none" || access.permission === null
        ? "not_found"
        : "forbidden",
  });
}
