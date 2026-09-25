import { v } from "convex/values";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { hashProjectToken, isProjectToken } from "./lib/projectTokens";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "stateofpixel";
const LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;

const githubJwks = createRemoteJWKSet(
  new URL(`${GITHUB_OIDC_ISSUER}/.well-known/jwks`),
);

type GithubOidcClaims = {
  repositoryId: number;
  repository: string;
  sha: string;
  ref: string;
  eventName: string;
  runId: string;
};

const ciProject = v.object({ id: v.id("projects"), fullName: v.string() });

type CiProject = { id: Id<"projects">; fullName: string };

export type CiAuth =
  | { method: "oidc"; project: CiProject; claims: GithubOidcClaims }
  | { method: "token"; project: CiProject };

export async function authenticateCi(
  ctx: ActionCtx,
  request: Request,
): Promise<CiAuth | null> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();

  if (isProjectToken(token)) {
    const project = await ctx.runMutation(internal.ciAuth.useProjectToken, {
      tokenHash: await hashProjectToken(token),
    });
    return project === null ? null : { method: "token", project };
  }

  const claims = await verifyGithubOidcToken(token);
  if (claims === null) {
    return null;
  }
  const project = await ctx.runQuery(internal.ciAuth.projectByGithubRepoId, {
    githubRepoId: claims.repositoryId,
  });
  return project === null ? null : { method: "oidc", project, claims };
}

async function verifyGithubOidcToken(
  token: string,
): Promise<GithubOidcClaims | null> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, githubJwks, {
      issuer: GITHUB_OIDC_ISSUER,
      audience: GITHUB_OIDC_AUDIENCE,
      algorithms: ["RS256"],
    }));
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      return null;
    }
    throw error;
  }
  const { repository_id, repository, sha, ref, event_name, run_id } = payload;
  if (
    typeof repository_id !== "string" ||
    typeof repository !== "string" ||
    typeof sha !== "string" ||
    typeof ref !== "string" ||
    typeof event_name !== "string" ||
    typeof run_id !== "string"
  ) {
    return null;
  }
  return {
    repositoryId: Number(repository_id),
    repository,
    sha,
    ref,
    eventName: event_name,
    runId: run_id,
  };
}

export const projectByGithubRepoId = internalQuery({
  args: { githubRepoId: v.number() },
  returns: v.union(ciProject, v.null()),
  handler: async (ctx, { githubRepoId }) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_githubRepoId", (q) => q.eq("githubRepoId", githubRepoId))
      .unique();
    if (project === null || project.archivedAt !== undefined) {
      return null;
    }
    return toCiProject(project);
  },
});

export const useProjectToken = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.union(ciProject, v.null()),
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("projectTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (token === null || token.revokedAt !== undefined) {
      return null;
    }
    const project = await ctx.db.get("projects", token.projectId);
    if (project === null || project.archivedAt !== undefined) {
      return null;
    }
    const now = Date.now();
    if (
      token.lastUsedAt === undefined ||
      now - token.lastUsedAt > LAST_USED_WRITE_INTERVAL_MS
    ) {
      await ctx.db.patch("projectTokens", token._id, { lastUsedAt: now });
    }
    return toCiProject(project);
  },
});

function toCiProject(project: Doc<"projects">): CiProject {
  return { id: project._id, fullName: `${project.owner}/${project.name}` };
}
