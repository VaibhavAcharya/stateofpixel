import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import DodoPayments from "dodopayments";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { internal } from "./_generated/api";
import {
  type ActionCtx,
  action,
  env,
  httpAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { planFields } from "./accounts";
import {
  type BillingEnvironment,
  isEndedStatus,
  planForProduct,
  productId,
} from "./lib/billing";
import { GithubError, isOrgOwner } from "./lib/github";

const paidPlan = v.union(
  v.literal("25gb"),
  v.literal("100gb"),
  v.literal("500gb"),
);
const interval = v.union(v.literal("monthly"), v.literal("yearly"));

type SubscriptionEvent = Extract<
  UnwrapWebhookEvent,
  { type: `subscription.${string}` }
>;

function billingEnvironment(): BillingEnvironment {
  return env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode";
}

function dodo(): DodoPayments {
  if (env.DODO_PAYMENTS_API_KEY === undefined) {
    throw new ConvexError({ code: "billing_not_configured" });
  }
  return new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    environment: billingEnvironment(),
  });
}

export const available = query({
  args: {},
  returns: v.boolean(),
  handler: async () =>
    env.DODO_PAYMENTS_API_KEY !== undefined &&
    productId(billingEnvironment(), "25gb", "monthly") !== null,
});

export const checkout = action({
  args: { login: v.string(), plan: paidPlan, interval },
  returns: v.string(),
  handler: async (ctx, { login, plan, interval }) => {
    const target = await requireBillingOwner(ctx, login);
    if (target.billingSubscriptionId !== null) {
      throw new ConvexError({ code: "already_subscribed" });
    }
    const product = productId(billingEnvironment(), plan, interval);
    if (product === null) {
      throw new ConvexError({ code: "billing_not_configured" });
    }
    const session = await dodo().checkoutSessions.create({
      product_cart: [{ product_id: product, quantity: 1 }],
      customer:
        target.billingCustomerId === null
          ? undefined
          : { customer_id: target.billingCustomerId },
      metadata: { accountId: target.accountId },
      return_url: `${env.SITE_URL}/${login}`,
    });
    if (session.checkout_url == null) {
      throw new Error("Dodo returned no checkout URL");
    }
    return session.checkout_url;
  },
});

export const portal = action({
  args: { login: v.string() },
  returns: v.string(),
  handler: async (ctx, { login }) => {
    const target = await requireBillingOwner(ctx, login);
    if (target.billingCustomerId === null) {
      throw new ConvexError({ code: "not_subscribed" });
    }
    const session = await dodo().customers.customerPortal.create(
      target.billingCustomerId,
      { return_url: `${env.SITE_URL}/${login}` },
    );
    return session.link;
  },
});

async function requireBillingOwner(ctx: ActionCtx, login: string) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ code: "not_signed_in" });
  }
  const target = await ctx.runQuery(internal.billing.target, {
    userId,
    login,
  });
  if (target === null) {
    throw new ConvexError({ code: "not_found" });
  }
  let owner: boolean;
  try {
    owner =
      target.accountType === "user"
        ? login === target.userLogin
        : await isOrgOwner(target.githubToken, login);
  } catch (error) {
    if (error instanceof GithubError && error.status === 401) {
      throw new ConvexError({ code: "github_token_invalid" });
    }
    throw error;
  }
  if (!owner) {
    throw new ConvexError({ code: "not_owner" });
  }
  return target;
}

export const target = internalQuery({
  args: { userId: v.id("users"), login: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      githubToken: v.string(),
      userLogin: v.string(),
      accountId: v.id("accounts"),
      accountType: v.union(v.literal("user"), v.literal("org")),
      billingCustomerId: v.union(v.string(), v.null()),
      billingSubscriptionId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { userId, login }) => {
    const user = await ctx.db.get("users", userId);
    if (user === null) {
      return null;
    }
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_login", (q) => q.eq("login", login))
      .first();
    if (account === null) {
      return null;
    }
    const membership = await ctx.db
      .query("accountMembers")
      .withIndex("by_accountId_and_userId", (q) =>
        q.eq("accountId", account._id).eq("userId", userId),
      )
      .unique();
    if (membership === null) {
      return null;
    }
    return {
      githubToken: user.githubToken,
      userLogin: user.login,
      accountId: account._id,
      accountType: account.type,
      billingCustomerId: account.billingCustomerId ?? null,
      billingSubscriptionId: account.billingSubscriptionId ?? null,
    };
  },
});

export const webhook = httpAction(async (ctx, request) => {
  if (env.DODO_PAYMENTS_WEBHOOK_SECRET === undefined) {
    return new Response("Billing is not configured", { status: 503 });
  }
  const body = await request.text();
  let event: UnwrapWebhookEvent;
  try {
    event = dodo().webhooks.unwrap(body, {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      },
      key: env.DODO_PAYMENTS_WEBHOOK_SECRET,
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (isSubscriptionEvent(event)) {
    const subscription = event.data;
    const accountId = subscription.metadata.accountId;
    await ctx.runMutation(internal.billing.syncSubscription, {
      accountId: typeof accountId === "string" ? accountId : null,
      subscriptionId: subscription.subscription_id,
      customerId: subscription.customer.customer_id,
      productId: subscription.product_id,
      status: subscription.status,
    });
  }
  return new Response(null, { status: 204 });
});

function isSubscriptionEvent(
  event: UnwrapWebhookEvent,
): event is SubscriptionEvent {
  return event.type.startsWith("subscription.");
}

export const syncSubscription = internalMutation({
  args: {
    accountId: v.union(v.string(), v.null()),
    subscriptionId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const accountId =
      args.accountId === null
        ? null
        : ctx.db.normalizeId("accounts", args.accountId);
    const account =
      accountId === null ? null : await ctx.db.get("accounts", accountId);
    if (account === null) {
      console.warn(`Subscription ${args.subscriptionId} has no known account`);
      return null;
    }

    if (args.status === "active") {
      const plan = planForProduct(billingEnvironment(), args.productId);
      if (plan === null) {
        console.warn(
          `Subscription ${args.subscriptionId} has unknown product ${args.productId}`,
        );
        return null;
      }
      await ctx.db.patch("accounts", account._id, {
        ...planFields(account, plan),
        billingCustomerId: args.customerId,
        billingSubscriptionId: args.subscriptionId,
      });
    } else if (
      isEndedStatus(args.status) &&
      account.billingSubscriptionId === args.subscriptionId
    ) {
      await ctx.db.patch("accounts", account._id, {
        ...planFields(account, "free"),
        billingSubscriptionId: undefined,
      });
    }
    return null;
  },
});
