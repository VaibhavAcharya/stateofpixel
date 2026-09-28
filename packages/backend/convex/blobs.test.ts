/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("deletes R2 image rows and frees their bytes", async () => {
  const t = convexTest(schema, modules);
  const accountId = await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "acme",
      type: "org",
      installationId: 10,
      plan: "free",
      storageLimitBytes: 10 * 1024 ** 3,
      storageBytes: 30,
    });
    const image = {
      accountId,
      kind: "screenshot" as const,
      width: 10,
      height: 10,
      lastReferencedAt: 0,
    };
    await ctx.db.insert("images", {
      ...image,
      hash: "a",
      bytes: 10,
      store: "r2",
      r2Key: "a",
    });
    await ctx.db.insert("images", {
      ...image,
      hash: "b",
      bytes: 5,
      store: "r2",
      r2Key: "b",
    });
    await ctx.db.insert("images", {
      ...image,
      hash: "c",
      bytes: 15,
      store: "convex",
      storageId: await ctx.storage.store(new Blob(["c"])),
    });
    return accountId;
  });

  await t.mutation(internal.blobs.deleteR2Images, {});
  await t.finishAllScheduledFunctions(() => {});

  const { images, account } = await t.run(async (ctx) => ({
    images: await ctx.db.query("images").collect(),
    account: await ctx.db.get("accounts", accountId),
  }));
  expect(images.map((image) => image.hash)).toEqual(["c"]);
  expect(account?.storageBytes).toBe(15);
});
