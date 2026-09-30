import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Doc, Id } from "../dataModel.ts";
import { first } from "../db/index.ts";
import {
  builds,
  projects,
  type repoPermission,
  repoPermissions,
} from "../schema.ts";
import { AppError, type QueryCtx } from "../server.ts";

export type RepoPermission = z.infer<typeof repoPermission>;

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
  const { userId } = ctx;
  if (userId === null) {
    return { userId, permission: null, fresh: false, usable: false };
  }
  const row = first(
    await ctx.db
      .select()
      .from(repoPermissions)
      .where(
        and(
          eq(repoPermissions.userId, userId),
          eq(repoPermissions.projectId, projectId),
        ),
      ),
  );
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

function isArchivedForWrite(
  project: Doc<"projects">,
  needed: Exclude<RepoPermission, "none">,
): boolean {
  return needed !== "read" && project.archivedAt !== null;
}

async function getProject(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const project = first(
    await ctx.db.select().from(projects).where(eq(projects._id, projectId)),
  );
  return project;
}

export async function findProject(
  ctx: QueryCtx,
  owner: string,
  name: string,
): Promise<Doc<"projects"> | null> {
  const project = first(
    await ctx.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.owner, owner),
          eq(projects.name, name),
          isNull(projects.archivedAt),
        ),
      )
      .limit(1),
  );
  return project;
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
  const project = await getProject(ctx, projectId);
  if (project === null || isArchivedForWrite(project, needed)) {
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
  const build = first(
    await ctx.db
      .select()
      .from(builds)
      .where(and(eq(builds.projectId, project._id), eq(builds.number, number))),
  );
  return build;
}

export async function requirePermission(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  needed: Exclude<RepoPermission, "none">,
): Promise<{ userId: Id<"users"> | null; project: Doc<"projects"> }> {
  const project = await getProject(ctx, projectId);
  if (project === null || isArchivedForWrite(project, needed)) {
    throw new AppError({ code: "not_found" });
  }
  const access = await readAccess(ctx, projectId);
  if (allows(project, access, needed)) {
    return { userId: access.userId, project };
  }
  if (access.userId === null) {
    throw new AppError({ code: "not_signed_in" });
  }
  if (!access.usable) {
    throw new AppError({ code: "permission_unknown" });
  }
  throw new AppError({
    code:
      access.permission === "none" || access.permission === null
        ? "not_found"
        : "forbidden",
  });
}
