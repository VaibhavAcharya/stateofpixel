/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const GIGABYTE = 1024 ** 3;
const WEBHOOK_SECRET = `whsec_${btoa("test-dodo-webhook-secret")}`;
const MONTHLY_25GB = "pdt_0NoN5TjZdBKHRU6UskUXu";

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
  });
  expect(updated?.overLimitSince).toBeUndefined();
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
