import { eq } from "drizzle-orm";
import { type CryptoKey, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { api } from "./api.ts";
import type { Id } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { projects, projectTokens } from "./schema.ts";
import { type TestBackend, testBackend } from "./test/backend.ts";
import { insertAccount, insertProject, insertUser } from "./test/fixtures.ts";

let githubKey: CryptoKey;
let otherKey: CryptoKey;
let githubJwk: Record<string, unknown>;
let repositoryPermissions: Record<string, boolean> | null;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  githubKey = privateKey;
  githubJwk = { ...(await exportJWK(publicKey)), kid: "github", alg: "RS256" };
  ({ privateKey: otherKey } = await generateKeyPair("RS256"));
});

beforeEach(() => {
  repositoryPermissions = { admin: true, push: true, pull: true };
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const { pathname } = new URL(input);
    if (pathname === "/.well-known/jwks") {
      return Response.json({ keys: [githubJwk] });
    }
    if (pathname === "/repos/acme/web-app") {
      return repositoryPermissions === null
        ? new Response("not found", { status: 404 })
        : Response.json({ permissions: repositoryPermissions });
    }
    if (pathname === "/user/memberships/orgs/acme") {
      return Response.json({ state: "active", role: "admin" });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function setup() {
  const t = testBackend();
  const { userId, projectId } = await t.run(async (ctx) => {
    const userId = await insertUser(ctx, {
      githubUserId: 42,
      login: "octocat",
      githubToken: "ghu_user",
    });
    const accountId = await insertAccount(ctx);
    const projectId = await insertProject(ctx, accountId);
    return { userId, projectId };
  });
  const user = t.withUser(userId);
  return { t, user, projectId };
}

async function oidcToken(
  claims: Record<string, unknown> = {},
  { key = githubKey, audience = "stateofpixel" } = {},
) {
  return new SignJWT({
    repository_id: "100",
    repository: "acme/web-app",
    sha: "d4e5f6",
    ref: "refs/pull/88/merge",
    event_name: "pull_request",
    run_id: "8123456789",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "github" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience(audience)
    .setSubject("repo:acme/web-app:pull_request")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

function whoami(t: TestBackend, token?: string) {
  return t.fetch("/api/v1/whoami", {
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  });
}

it("accepts a GitHub Actions OIDC token for a known repository", async () => {
  const { t } = await setup();
  const response = await whoami(t, await oidcToken());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    project: "acme/web-app",
    method: "oidc",
  });
});

it("rejects OIDC tokens that are not ours", async () => {
  const { t } = await setup();
  const rejected = [
    undefined,
    "not-a-jwt",
    await oidcToken({}, { audience: "someone-else" }),
    await oidcToken({}, { key: otherKey }),
    await oidcToken({ repository_id: "999" }),
  ];
  for (const token of rejected) {
    const response = await whoami(t, token);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "unauthorized" },
    });
  }
});

it("rejects OIDC tokens for an archived project", async () => {
  const { t, projectId } = await setup();
  await t.run((ctx) =>
    ctx.db
      .update(projects)
      .set({ archivedAt: Date.now() })
      .where(eq(projects._id, projectId)),
  );
  expect((await whoami(t, await oidcToken())).status).toBe(401);
});

it("creates, uses and revokes a project token", async () => {
  const { t, user, projectId } = await setup();
  await user.action(api.permissions.refresh, { projectId });

  const token = await user.action(api.tokens.create, {
    projectId,
    name: " CircleCI ",
  });
  expect(token).toMatch(/^sop_[0-9A-Za-z]{43}$/);

  const response = await whoami(t, token);
  expect(await response.json()).toEqual({
    project: "acme/web-app",
    method: "token",
  });

  const [listed] = (await user.query(api.tokens.list, { projectId })) ?? [];
  expect(listed).toMatchObject({ name: "CircleCI" });
  expect(listed?.lastUsedAt).not.toBeNull();
  const stored = await t.run(async (ctx) =>
    first(await ctx.db.select().from(projectTokens).limit(1)),
  );
  expect(stored?.tokenHash).not.toContain(token);

  await user.mutation(api.tokens.revoke, {
    tokenId: listed?.id as Id<"projectTokens">,
  });
  expect((await whoami(t, token)).status).toBe(401);
  expect(await user.query(api.tokens.list, { projectId })).toEqual([]);
});

it("rejects an unknown project token", async () => {
  const { t } = await setup();
  expect((await whoami(t, `sop_${"a".repeat(43)}`)).status).toBe(401);
});

it("needs a fresh permission check before managing tokens", async () => {
  const { user, projectId } = await setup();
  await expect(
    user.action(api.tokens.create, { projectId, name: "ci" }),
  ).rejects.toThrow(/permission_unknown/);
});

it("only lets repository admins manage tokens", async () => {
  const { user, projectId } = await setup();
  repositoryPermissions = { admin: false, push: true, pull: true };
  expect(await user.action(api.permissions.refresh, { projectId })).toBe(
    "write",
  );
  await expect(
    user.action(api.tokens.create, { projectId, name: "ci" }),
  ).rejects.toThrow(/forbidden/);

  repositoryPermissions = null;
  expect(await user.action(api.permissions.refresh, { projectId })).toBe(
    "none",
  );
  expect(await user.query(api.tokens.list, { projectId })).toBeNull();
});
