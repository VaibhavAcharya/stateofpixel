import { eq } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./api.ts";
import { first } from "./db/index.ts";
import { accounts } from "./schema.ts";
import { testBackend } from "./test/backend.ts";
import { insertAccount } from "./test/fixtures.ts";

const GIGABYTE = 1024 ** 3;

afterEach(() => {
  vi.unstubAllEnvs();
});

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

it("puts accounts on the unlimited plan on a self-hosted server", async () => {
  const { t, account } = await setup();
  vi.stubEnv("STATEOFPIXEL_SELF_HOSTED", "true");
  const upsert = (providerAccountId: number, login: string) =>
    t.mutation(internal.installations.upsertAccount, {
      installationId: providerAccountId * 10,
      providerAccountId,
      login,
      type: "org",
    });

  await upsert(1, "acme");
  const existing = await account();
  expect(existing).toMatchObject({
    plan: "unlimited",
    storageLimitBytes: Number.MAX_SAFE_INTEGER,
  });
  expect(existing?.overLimitSince).toBeNull();

  const created = await upsert(2, "globex");
  expect(
    await t.run(async (ctx) =>
      first(
        await ctx.db.select().from(accounts).where(eq(accounts._id, created)),
      ),
    ),
  ).toMatchObject({
    plan: "unlimited",
    storageLimitBytes: Number.MAX_SAFE_INTEGER,
  });
});

it("keeps a custom plan on a self-hosted server", async () => {
  const { t, account } = await setup();
  await t.mutation(internal.accounts.setPlan, {
    login: "acme",
    plan: "custom",
    storageLimitBytes: 2000 * GIGABYTE,
  });
  vi.stubEnv("STATEOFPIXEL_SELF_HOSTED", "true");
  await t.mutation(internal.installations.upsertAccount, {
    installationId: 10,
    providerAccountId: 1,
    login: "acme",
    type: "org",
  });
  expect(await account()).toMatchObject({
    plan: "custom",
    storageLimitBytes: 2000 * GIGABYTE,
  });
});

it("creates accounts on the free plan by default", async () => {
  const t = testBackend();
  const created = await t.mutation(internal.installations.upsertAccount, {
    installationId: 20,
    providerAccountId: 2,
    login: "globex",
    type: "org",
  });
  expect(
    await t.run(async (ctx) =>
      first(
        await ctx.db.select().from(accounts).where(eq(accounts._id, created)),
      ),
    ),
  ).toMatchObject({ plan: "free", storageLimitBytes: 10 * GIGABYTE });
});
