/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("returns null when signed out", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.users.viewer, {})).toBeNull();
});

it("returns the signed-in user without the GitHub token", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      githubUserId: 42,
      login: "octocat",
      image: "https://avatars.githubusercontent.com/u/42",
      githubToken: "ghu_secret",
      lastSeenAt: 0,
    }),
  );

  const viewer = await t
    .withIdentity({ subject: `${userId}|session` })
    .query(api.users.viewer, {});

  expect(viewer).toEqual({
    login: "octocat",
    name: null,
    image: "https://avatars.githubusercontent.com/u/42",
  });
});
