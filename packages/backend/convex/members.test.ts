/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubOrgRoles(roles: Record<string, string>) {
  vi.stubGlobal("fetch", async (_input: string | URL, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("Authorization") ?? "";
    const role = roles[token.replace("Bearer ", "")];
    return role === undefined
      ? new Response("not found", { status: 404 })
      : Response.json({ state: "active", role });
  });
}

async function setup(type: "user" | "org") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: type === "org" ? "acme" : "octocat",
      type,
      installationId: 10,
      plan: "free",
      storageLimitBytes: 10 * 1024 ** 3,
      storageBytes: 0,
    });
    const users = [];
    for (const [index, login] of ["octocat", "hubot"].entries()) {
      const userId = await ctx.db.insert("users", {
        githubUserId: index + 1,
        login,
        githubToken: `ghu_${login}`,
        lastSeenAt: index,
      });
      await ctx.db.insert("accountMembers", { accountId, userId });
      users.push(userId);
    }
    return { octocat: users[0], hubot: users[1] };
  });
  return {
    t,
    octocat: t.withIdentity({ subject: `${ids.octocat}|session` }),
    hubot: t.withIdentity({ subject: `${ids.hubot}|session` }),
  };
}

it("knows the owner of a personal account without GitHub", async () => {
  const { octocat, hubot } = await setup("user");
  expect(
    await octocat.query(api.accounts.home, { login: "octocat" }),
  ).toMatchObject({
    role: "owner",
  });
  expect(
    await hubot.query(api.accounts.home, { login: "octocat" }),
  ).toMatchObject({
    role: "member",
  });
  expect(
    await hubot.action(api.members.refreshRole, { login: "octocat" }),
  ).toBe("member");
});

it("lists org members with the roles GitHub gives them, owners first", async () => {
  const { octocat, hubot } = await setup("org");
  expect(
    (await octocat.query(api.members.list, { login: "acme" }))?.map(
      (member) => member.role,
    ),
  ).toEqual([null, null]);

  stubOrgRoles({ ghu_octocat: "member", ghu_hubot: "admin" });
  expect(await octocat.action(api.members.refreshRole, { login: "acme" })).toBe(
    "member",
  );
  expect(await hubot.action(api.members.refreshRole, { login: "acme" })).toBe(
    "owner",
  );

  expect(await octocat.query(api.members.list, { login: "acme" })).toEqual([
    { login: "hubot", name: null, image: null, role: "owner", lastSeenAt: 1 },
    {
      login: "octocat",
      name: null,
      image: null,
      role: "member",
      lastSeenAt: 0,
    },
  ]);
  expect(
    await octocat.query(api.accounts.home, { login: "acme" }),
  ).toMatchObject({
    role: "member",
  });
});

it("hides the members of an account from people outside it", async () => {
  const { t } = await setup("org");
  const strangerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      githubUserId: 7,
      login: "stranger",
      githubToken: "ghu_stranger",
      lastSeenAt: 0,
    }),
  );
  const stranger = t.withIdentity({ subject: `${strangerId}|session` });
  expect(await stranger.query(api.members.list, { login: "acme" })).toBeNull();
  await expect(
    stranger.action(api.members.refreshRole, { login: "acme" }),
  ).rejects.toThrow("not_found");
});
