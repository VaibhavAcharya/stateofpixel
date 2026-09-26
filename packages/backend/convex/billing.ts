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
  type BillingInterval,
  isEndedStatus,
  type PaidPlan,
  productId,
  productPlan,
} from "./lib/billing";
import { PLAN_STORAGE_LIMIT_BYTES } from "./lib/storage";
import { isAccountOwner } from "./members";

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

function billingUrl(login: string): string {
  return `${env.SITE_URL}/${login}/settings/billing`;
}

export const available = query({
  args: {},
  returns: v.boolean(),
  handler: async () => env.DODO_PAYMENTS_API_KEY !== undefined,
});

export const checkout = action({
  args: { login: v.string(), plan: paidPlan, interval },
  returns: v.string(),
  handler: async (ctx, { login, plan, interval }) => {
    const target = await requireBillingOwner(ctx, login);
    if (target.billingSubscriptionId !== null) {
      throw new ConvexError({ code: "already_subscribed" });
    }
    const session = await dodo().checkoutSessions.create({
      product_cart: [
        {
          product_id: productId(billingEnvironment(), plan, interval),
          quantity: 1,
        },
      ],
      customer:
        target.billingCustomerId === null
          ? undefined
          : { customer_id: target.billingCustomerId },
      metadata: { accountId: target.accountId },
      return_url: billingUrl(login),
    });
    if (session.checkout_url == null) {
      throw new Error("Dodo returned no checkout URL");
    }
    return session.checkout_url;
  },
});

export const previewPlanChange = action({
  args: { login: v.string(), plan: paidPlan, interval },
  returns: v.object({
    amount: v.number(),
    currency: v.string(),
    renewsAt: v.number(),
  }),
  handler: async (ctx, { login, plan, interval }) => {
    const subscriptionId = await requirePlanChange(ctx, login, plan, interval);
    const preview = await dodo().subscriptions.previewChangePlan(
      subscriptionId,
      planChange(plan, interval),
    );
    return {
      amount: preview.immediate_charge.summary.total_amount,
      currency: preview.immediate_charge.summary.currency,
      renewsAt: Date.parse(preview.new_plan.next_billing_date),
    };
  },
});

export const changePlan = action({
  args: { login: v.string(), plan: paidPlan, interval },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { login, plan, interval }) => {
    const subscriptionId = await requirePlanChange(ctx, login, plan, interval);
    const result = await dodo().subscriptions.changePlan(subscriptionId, {
      ...planChange(plan, interval),
      on_payment_failure: "prevent_change",
    });
    return result.payment_link ?? null;
  },
});

function planChange(plan: PaidPlan, interval: BillingInterval) {
  return {
    product_id: productId(billingEnvironment(), plan, interval),
    quantity: 1,
    proration_billing_mode: "prorated_immediately" as const,
  };
}

async function requirePlanChange(
  ctx: ActionCtx,
  login: string,
  plan: PaidPlan,
  interval: BillingInterval,
): Promise<string> {
  const target = await requireBillingOwner(ctx, login);
  if (target.billingSubscriptionId === null) {
    throw new ConvexError({ code: "not_subscribed" });
  }
  if (target.plan === plan && target.billingInterval === interval) {
    throw new ConvexError({ code: "same_plan" });
  }
  if (target.storageBytes > PLAN_STORAGE_LIMIT_BYTES[plan]) {
    throw new ConvexError({ code: "over_plan_limit" });
  }
  return target.billingSubscriptionId;
}

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
      { return_url: billingUrl(login) },
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
  const owner = await isAccountOwner(target.githubToken, target.userLogin, {
    type: target.accountType,
    login,
  });
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
      billingInterval: v.union(interval, v.null()),
      plan: v.string(),
      storageBytes: v.number(),
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
      billingInterval: account.billingInterval ?? null,
      plan: account.plan,
      storageBytes: account.storageBytes,
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
      periodEndsAt: Date.parse(subscription.next_billing_date),
      cancelsAtPeriodEnd: subscription.cancel_at_next_billing_date,
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
    periodEndsAt: v.number(),
    cancelsAtPeriodEnd: v.boolean(),
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
      const product = productPlan(billingEnvironment(), args.productId);
      if (product === null) {
        console.warn(
          `Subscription ${args.subscriptionId} has unknown product ${args.productId}`,
        );
        return null;
      }
      await ctx.db.patch("accounts", account._id, {
        ...planFields(account, product.plan),
        billingCustomerId: args.customerId,
        billingSubscriptionId: args.subscriptionId,
        billingStatus: args.status,
        billingInterval: product.interval,
        billingPeriodEndsAt: args.periodEndsAt,
        billingCancelsAtPeriodEnd: args.cancelsAtPeriodEnd,
      });
    } else if (account.billingSubscriptionId !== args.subscriptionId) {
      return null;
    } else if (isEndedStatus(args.status)) {
      await ctx.db.patch("accounts", account._id, {
        ...planFields(account, "free"),
        billingSubscriptionId: undefined,
        billingStatus: undefined,
        billingInterval: undefined,
        billingPeriodEndsAt: undefined,
        billingCancelsAtPeriodEnd: undefined,
      });
    } else {
      await ctx.db.patch("accounts", account._id, {
        billingStatus: args.status,
        billingPeriodEndsAt: args.periodEndsAt,
        billingCancelsAtPeriodEnd: args.cancelsAtPeriodEnd,
      });
    }
    return null;
  },
});
