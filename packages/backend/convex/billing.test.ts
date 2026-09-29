/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const GIGABYTE = 1024 ** 3;
const WEBHOOK_SECRET = `whsec_${btoa("test-dodo-webhook-secret")}`;
const MONTHLY_25GB = "pdt_0NoN5TjZdBKHRU6UskUXu";
const YEARLY_100GB = "pdt_0NoN5ToBDApZ02O0BMR1K";
const NEXT_BILLING_DATE = "2026-10-25T10:00:00Z";

beforeAll(() => {
  vi.stubEnv("DODO_PAYMENTS_API_KEY", "test-api-key");
  vi.stubEnv("DODO_PAYMENTS_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("DODO_PAYMENTS_ENVIRONMENT", "test_mode");
});

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
    accountId,
    account: () => t.run((ctx) => ctx.db.get("accounts", accountId)),
  };
}

function subscriptionEvent(
  type: string,
  fields: {
    accountId: string;
    subscriptionId: string;
    status: string;
    productId?: string;
    cancelAtNextBillingDate?: boolean;
  },
) {
  return {
    business_id: "bus_test",
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Subscription",
      subscription_id: fields.subscriptionId,
      status: fields.status,
      product_id: fields.productId ?? MONTHLY_25GB,
      next_billing_date: NEXT_BILLING_DATE,
      cancel_at_next_billing_date: fields.cancelAtNextBillingDate ?? false,
      customer: { customer_id: "cus_acme", email: "billing@acme.test" },
      metadata: { accountId: fields.accountId },
    },
  };
}

async function sign(id: string, timestamp: string, body: string) {
  const secret = Uint8Array.from(
    atob(WEBHOOK_SECRET.slice("whsec_".length)),
    (char) => char.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function deliver(
  t: ReturnType<typeof convexTest>,
  event: unknown,
  signature?: string,
) {
  const body = JSON.stringify(event);
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  return t.fetch("/dodo/webhook", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature ?? (await sign(id, timestamp, body)),
    },
    body,
  });
}

it("rejects a webhook with a wrong signature", async () => {
  const { t, accountId, account } = await setup();
  const response = await deliver(
    t,
    subscriptionEvent("subscription.active", {
      accountId,
      subscriptionId: "sub_1",
      status: "active",
    }),
    "v1,d3Jvbmc=",
  );
  expect(response.status).toBe(401);
  expect(await account()).toMatchObject({ plan: "free" });
});

it("moves the account to the plan of an active subscription", async () => {
  const { t, accountId, account } = await setup();
  const response = await deliver(
    t,
    subscriptionEvent("subscription.active", {
      accountId,
      subscriptionId: "sub_1",
      status: "active",
    }),
  );
  expect(response.status).toBe(204);
  const updated = await account();
  expect(updated).toMatchObject({
    plan: "25gb",
    storageLimitBytes: 25 * GIGABYTE,
    billingCustomerId: "cus_acme",
    billingSubscriptionId: "sub_1",
    billingInterval: "monthly",
  });
  expect(updated?.overLimitSince).toBeUndefined();
});

it("follows a plan change on the same subscription", async () => {
  const { t, accountId, account } = await setup();
  await deliver(
    t,
    subscriptionEvent("subscription.active", {
      accountId,
      subscriptionId: "sub_1",
      status: "active",
    }),
  );
  await deliver(
    t,
    subscriptionEvent("subscription.plan_changed", {
      accountId,
      subscriptionId: "sub_1",
      status: "active",
      productId: YEARLY_100GB,
    }),
  );
  expect(await account()).toMatchObject({
    plan: "100gb",
    storageLimitBytes: 100 * GIGABYTE,
    billingSubscriptionId: "sub_1",
    billingInterval: "yearly",
  });
});

it("moves the account back to free when its subscription ends", async () => {
  const { t, accountId, account } = await setup();
  await deliver(
    t,
    subscriptionEvent("subscription.active", {
      accountId,
      subscriptionId: "sub_1",
      status: "active",
    }),
  );
  await deliver(
    t,
    subscriptionEvent("subscription.cancelled", {
      accountId,
      subscriptionId: "sub_1",
      status: "cancelled",
    }),
  );
  const updated = await account();
  expect(updated).toMatchObject({
    plan: "free",
    storageLimitBytes: 10 * GIGABYTE,
    billingCustomerId: "cus_acme",
    overLimitSince: expect.any(Number),
  });
  expect(updated?.billingSubscriptionId).toBeUndefined();
});

it("ignores the end of a subscription the account no longer uses", async () => {
  const { t, accountId, account } = await setup();
  await deliver(
    t,
    subscriptionEvent("subscription.active", {
      accountId,
      subscriptionId: "sub_2",
      status: "active",
    }),
  );
  await deliver(
    t,
    subscriptionEvent("subscription.expired", {
      accountId,
      subscriptionId: "sub_1",
      status: "expired",
    }),
  );
  expect(await account()).toMatchObject({
    plan: "25gb",
    billingSubscriptionId: "sub_2",
  });
});

it("keeps the tracked subscription when a second one becomes active", async () => {
  const { t, accountId, account } = await setup();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  for (const subscriptionId of ["sub_1", "sub_2"]) {
    await deliver(
      t,
      subscriptionEvent("subscription.active", {
        accountId,
        subscriptionId,
        status: "active",
      }),
    );
  }
  expect(await account()).toMatchObject({
    plan: "25gb",
    billingSubscriptionId: "sub_1",
  });
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("sub_2"));
  vi.restoreAllMocks();
});

it("is available when the deployment has an API key", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(api.billing.available, {})).toBe(true);
  vi.stubEnv("DODO_PAYMENTS_API_KEY", undefined);
  expect(await t.query(api.billing.available, {})).toBe(false);
  vi.stubEnv("DODO_PAYMENTS_API_KEY", "test-api-key");
});

it("keeps the plan while a renewal payment fails, and records it", async () => {
  const { t, accountId, account } = await setup();
  const event = (type: string, status: string) =>
    subscriptionEvent(type, { accountId, subscriptionId: "sub_1", status });
  await deliver(t, event("subscription.active", "active"));
  await deliver(t, event("subscription.on_hold", "on_hold"));
  expect(await account()).toMatchObject({
    plan: "25gb",
    billingStatus: "on_hold",
  });
  await deliver(t, event("subscription.renewed", "active"));
  expect(await account()).toMatchObject({
    plan: "25gb",
    billingStatus: "active",
  });
});

it("keeps the plan until a subscription cancelled at the next billing date ends", async () => {
  const { t, accountId, account } = await setup();
  const fields = { accountId, subscriptionId: "sub_1", status: "active" };
  await deliver(t, subscriptionEvent("subscription.active", fields));
  expect(await account()).toMatchObject({
    billingPeriodEndsAt: Date.parse(NEXT_BILLING_DATE),
    billingCancelsAtPeriodEnd: false,
  });
  await deliver(
    t,
    subscriptionEvent("subscription.updated", {
      ...fields,
      cancelAtNextBillingDate: true,
    }),
  );
  expect(await account()).toMatchObject({
    plan: "25gb",
    billingSubscriptionId: "sub_1",
    billingCancelsAtPeriodEnd: true,
  });
  await deliver(
    t,
    subscriptionEvent("subscription.cancelled", {
      ...fields,
      status: "cancelled",
      cancelAtNextBillingDate: true,
    }),
  );
  const ended = await account();
  expect(ended).toMatchObject({ plan: "free" });
  expect(ended?.billingPeriodEndsAt).toBeUndefined();
  expect(ended?.billingCancelsAtPeriodEnd).toBeUndefined();
});

async function subscribedOwner(storageBytes: number) {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const accountId = await ctx.db.insert("accounts", {
      githubAccountId: 1,
      login: "octocat",
      type: "user",
      plan: "100gb",
      storageLimitBytes: 100 * GIGABYTE,
      storageBytes,
      billingCustomerId: "cus_octocat",
      billingSubscriptionId: "sub_1",
      billingStatus: "active",
      billingInterval: "yearly",
    });
    const userId = await ctx.db.insert("users", {
      githubUserId: 1,
      login: "octocat",
      githubToken: "ghu_octocat",
      lastSeenAt: 0,
    });
    await ctx.db.insert("accountMembers", { accountId, userId });
    return userId;
  });
  return t.withIdentity({ subject: `${userId}|session` });
}

it("refuses to change to the plan the account is on", async () => {
  const owner = await subscribedOwner(GIGABYTE);
  await expect(
    owner.action(api.billing.changePlan, {
      login: "octocat",
      plan: "100gb",
      interval: "yearly",
    }),
  ).rejects.toThrow(/same_plan/);
});

it("refuses to change to a plan smaller than the storage used", async () => {
  const owner = await subscribedOwner(30 * GIGABYTE);
  await expect(
    owner.action(api.billing.previewPlanChange, {
      login: "octocat",
      plan: "25gb",
      interval: "yearly",
    }),
  ).rejects.toThrow(/over_plan_limit/);
});
