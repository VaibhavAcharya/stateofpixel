import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { internal } from "./api.ts";
import { first } from "./db/index.ts";
import { accounts } from "./schema.ts";
import { testBackend } from "./test/backend.ts";
import { insertAccount } from "./test/fixtures.ts";

const GIGABYTE = 1024 ** 3;

async function setup() {
  const t = testBackend();
  const accountId = await t.run((ctx) =>
    insertAccount(ctx, {
      providerAccountId: 1,
      login: "acme",
      type: "org",
      installationId: null,
      plan: "free",
      storageLimitBytes: 10 * GIGABYTE,
      storageBytes: 12 * GIGABYTE,
      overLimitSince: 1,
    }),
  );
  return {
    t,
    account: () =>
      t.run(async (ctx) =>
        first(
          await ctx.db
            .select()
            .from(accounts)
            .where(eq(accounts._id, accountId)),
        ),
      ),
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
  expect(updated?.overLimitSince).toBeNull();
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
