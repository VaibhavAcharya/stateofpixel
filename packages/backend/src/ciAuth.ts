import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import { z } from "zod";
import { internal } from "./api.ts";
import type { Doc, Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { hashProjectToken, isProjectToken } from "./lib/projectTokens.ts";
import { projects, projectTokens } from "./schema.ts";
import { type ActionCtx, internalMutation, internalQuery } from "./server.ts";

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

type CiProject = { id: Id<"projects">; fullName: string };

export type CiAuth =
  | { method: "oidc"; project: CiProject; claims: GithubOidcClaims }
  | { method: "token"; project: CiProject; tokenHash: string };

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
    const tokenHash = await hashProjectToken(token);
    const project = await ctx.runMutation(internal.ciAuth.useProjectToken, {
      tokenHash,
    });
    return project === null ? null : { method: "token", project, tokenHash };
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
  args: { githubRepoId: z.number() },
  handler: async (ctx, { githubRepoId }) => {
    const project = first(
      await ctx.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.provider, "github"),
            eq(projects.providerRepoId, githubRepoId),
          ),
        )
        .limit(1),
    );
    if (project === null || project.archivedAt !== null) {
      return null;
    }
    return toCiProject(project);
  },
});

export const useProjectToken = internalMutation({
  args: { tokenHash: z.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = first(
      await ctx.db
        .select()
        .from(projectTokens)
        .where(eq(projectTokens.tokenHash, tokenHash)),
    );
    if (token === null || token.revokedAt !== null) {
      return null;
    }
    const project = first(
      await ctx.db
        .select()
        .from(projects)
        .where(eq(projects._id, token.projectId)),
    );
    if (project === null || project.archivedAt !== null) {
      return null;
    }
    const now = Date.now();
    if (
      token.lastUsedAt === null ||
      now - token.lastUsedAt > LAST_USED_WRITE_INTERVAL_MS
    ) {
      await ctx.db
        .update(projectTokens)
        .set({ lastUsedAt: now })
        .where(eq(projectTokens._id, token._id));
    }
    return toCiProject(project);
  },
});

function toCiProject(project: Doc<"projects">): CiProject {
  return { id: project._id, fullName: `${project.owner}/${project.name}` };
}
