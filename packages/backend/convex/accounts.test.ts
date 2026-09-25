/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const GIGABYTE = 1024 ** 3;

async function setup() {
  const t = convexTest(schema, modules);
  const accountId = await t.run((ctx) =>
    ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "acme",
      type: "org",
      plan: "free",
      storageLimitBytes: 10 * GIGABYTE,
      storageBytes: 12 * GIGABYTE,
      overLimitSince: 1,
    }),
  );
  return {
    t,
    account: () => t.run((ctx) => ctx.db.get("accounts", accountId)),
  };
}

it("moves an account to a bigger plan and ends its grace period", async () => {
  const { t, account } = await setup();
  await t.mutation(internal.accounts.setPlan, { login: "acme", plan: "25gb" });
  const updated = await account();
  expect(updated).toMatchObject({
    plan: "25gb",
    storageLimitBytes: 25 * GIGABYTE,
  });
  expect(updated?.overLimitSince).toBeUndefined();
});

it("needs a limit for a custom plan", async () => {
  const { t, account } = await setup();
  await expect(
    t.mutation(internal.accounts.setPlan, { login: "acme", plan: "custom" }),
  ).rejects.toThrow("A custom plan needs storageLimitBytes");
  await t.mutation(internal.accounts.setPlan, {
    login: "acme",
    plan: "custom",
    storageLimitBytes: 2000 * GIGABYTE,
  });
  expect(await account()).toMatchObject({
    plan: "custom",
    storageLimitBytes: 2000 * GIGABYTE,
  });
});
