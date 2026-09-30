import { expect, it } from "vitest";
import { api } from "./api.ts";
import { one } from "./db/index.ts";
import { connections, users } from "./schema.ts";
import { testBackend } from "./test/backend.ts";

it("returns null when signed out", async () => {
  const t = testBackend();
  expect(await t.query(api.users.viewer, {})).toBeNull();
});

it("returns the signed-in user without the GitHub token", async () => {
  const t = testBackend();
  const userId = await t.run(async (ctx) => {
    const user = one(
      await ctx.db
        .insert(users)
        .values({
          identityId: "identity-42",
          image: "https://avatars.githubusercontent.com/u/42",
          lastSeenAt: 0,
        })
        .returning(),
    );
    await ctx.db.insert(connections).values({
      userId: user._id,
      provider: "github",
      providerUserId: 42,
      login: "octocat",
      accessToken: "encrypted",
    });
    return user._id;
  });

  const viewer = await t.withUser(userId).query(api.users.viewer, {});

  expect(viewer).toEqual({
    login: "octocat",
    name: null,
    image: "https://avatars.githubusercontent.com/u/42",
  });
});

it("returns no login before GitHub is connected", async () => {
  const t = testBackend();
  const userId = await t.run(async (ctx) => {
    const user = one(
      await ctx.db
        .insert(users)
        .values({ identityId: "identity-1", name: "Ada", lastSeenAt: 0 })
        .returning(),
    );
    return user._id;
  });

  expect(await t.withUser(userId).query(api.users.viewer, {})).toEqual({
    login: null,
    name: "Ada",
    image: null,
  });
});
