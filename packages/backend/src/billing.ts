import DodoPayments from "dodopayments";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { planFields } from "./accounts.ts";
import { internal } from "./api.ts";
import { githubUserToken } from "./connections.ts";
import { first } from "./db/index.ts";
import { env } from "./env.ts";
import {
  type BillingEnvironment,
  type BillingInterval,
  isEndedStatus,
  type PaidPlan,
  productId,
  productPlan,
} from "./lib/billing.ts";
import { PLAN_STORAGE_LIMIT_BYTES } from "./lib/storage.ts";
import { isAccountOwner } from "./members.ts";
import { accountMembers, accounts, connections, users } from "./schema.ts";
import {
  type ActionCtx,
  AppError,
  action,
  httpAction,
  internalMutation,
  internalQuery,
  query,
} from "./server.ts";

const paidPlan = z.enum(["25gb", "100gb", "500gb"]);
const interval = z.enum(["monthly", "yearly"]);

type SubscriptionEvent = Extract<
  UnwrapWebhookEvent,
  { type: `subscription.${string}` }
>;

function billingEnvironment(): BillingEnvironment {
  return env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode";
}

function dodo(): DodoPayments {
  if (env.DODO_PAYMENTS_API_KEY === undefined) {
    throw new AppError({ code: "billing_not_configured" });
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
  handler: async () => env.DODO_PAYMENTS_API_KEY !== undefined,
});

export const checkout = action({
  args: { login: z.string(), plan: paidPlan, interval },
  handler: async (ctx, { login, plan, interval }) => {
    const target = await requireBillingOwner(ctx, login);
    if (
      target.billingSubscriptionId !== null ||
      (await hasActiveSubscription(target.billingCustomerId, target.accountId))
    ) {
      throw new AppError({ code: "already_subscribed" });
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

async function hasActiveSubscription(
  customerId: string | null,
  accountId: string,
): Promise<boolean> {
  if (customerId === null) {
    return false;
  }
  for await (const subscription of dodo().subscriptions.list({
    customer_id: customerId,
    status: "active",
  })) {
    if (subscription.metadata.accountId === accountId) {
      return true;
    }
  }
  return false;
}

export const previewPlanChange = action({
  args: { login: z.string(), plan: paidPlan, interval },
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
  args: { login: z.string(), plan: paidPlan, interval },
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
    throw new AppError({ code: "not_subscribed" });
  }
  if (target.plan === plan && target.billingInterval === interval) {
    throw new AppError({ code: "same_plan" });
  }
  if (target.storageBytes > PLAN_STORAGE_LIMIT_BYTES[plan]) {
    throw new AppError({ code: "over_plan_limit" });
  }
  return target.billingSubscriptionId;
}

export const portal = action({
  args: { login: z.string() },
  handler: async (ctx, { login }) => {
    const target = await requireBillingOwner(ctx, login);
    if (target.billingCustomerId === null) {
      throw new AppError({ code: "not_subscribed" });
    }
    const session = await dodo().customers.customerPortal.create(
      target.billingCustomerId,
      { return_url: billingUrl(login) },
    );
    return session.link;
  },
});

async function requireBillingOwner(ctx: ActionCtx, login: string) {
  const { userId } = ctx;
  if (userId === null) {
    throw new AppError({ code: "not_signed_in" });
  }
  const target = await ctx.runQuery(internal.billing.target, {
    userId,
    login,
  });
  if (target === null) {
    throw new AppError({ code: "not_found" });
  }
  const githubToken = await githubUserToken(ctx, userId);
  if (githubToken === null || target.userLogin === null) {
    throw new AppError({ code: "github_not_connected" });
  }
  const owner = await isAccountOwner(githubToken, target.userLogin, {
    type: target.accountType,
    login,
  });
  if (!owner) {
    throw new AppError({ code: "not_owner" });
  }
  return target;
}

export const target = internalQuery({
  args: { userId: z.string(), login: z.string() },
  handler: async (ctx, { userId, login }) => {
    const user = first(
      await ctx.db
        .select({ login: connections.login })
        .from(users)
        .leftJoin(
          connections,
          and(
            eq(connections.userId, users._id),
            eq(connections.provider, "github"),
          ),
        )
        .where(eq(users._id, userId)),
    );
    if (user === null) {
      return null;
    }
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.login, login))
        .orderBy(asc(accounts._creationTime), asc(accounts._id))
        .limit(1),
    );
    if (account === null) {
      return null;
    }
    const membership = first(
      await ctx.db
        .select()
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.accountId, account._id),
            eq(accountMembers.userId, userId),
          ),
        ),
    );
    if (membership === null) {
      return null;
    }
    return {
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
    accountId: z.string().nullable(),
    subscriptionId: z.string(),
    customerId: z.string(),
    productId: z.string(),
    status: z.string(),
    periodEndsAt: z.number(),
    cancelsAtPeriodEnd: z.boolean(),
  },
  handler: async (ctx, args) => {
    const { accountId } = args;
    const account =
      accountId === null
        ? null
        : first(
            await ctx.db
              .select()
              .from(accounts)
              .where(eq(accounts._id, accountId)),
          );
    if (account === null) {
      console.warn(`Subscription ${args.subscriptionId} has no known account`);
      return null;
    }

    if (
      args.status === "active" &&
      account.billingSubscriptionId !== null &&
      account.billingSubscriptionId !== args.subscriptionId
    ) {
      console.error(
        `Subscription ${args.subscriptionId} is active, but account ${account._id} already has subscription ${account.billingSubscriptionId}`,
      );
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
      await ctx.db
        .update(accounts)
        .set({
          ...planFields(account, product.plan),
          billingCustomerId: args.customerId,
          billingSubscriptionId: args.subscriptionId,
          billingStatus: args.status,
          billingInterval: product.interval,
          billingPeriodEndsAt: args.periodEndsAt,
          billingCancelsAtPeriodEnd: args.cancelsAtPeriodEnd,
        })
        .where(eq(accounts._id, account._id));
    } else if (account.billingSubscriptionId !== args.subscriptionId) {
      return null;
    } else if (isEndedStatus(args.status)) {
      await ctx.db
        .update(accounts)
        .set({
          ...planFields(account, "free"),
          billingSubscriptionId: null,
          billingStatus: null,
          billingInterval: null,
          billingPeriodEndsAt: null,
          billingCancelsAtPeriodEnd: null,
        })
        .where(eq(accounts._id, account._id));
    } else {
      await ctx.db
        .update(accounts)
        .set({
          billingStatus: args.status,
          billingPeriodEndsAt: args.periodEndsAt,
          billingCancelsAtPeriodEnd: args.cancelsAtPeriodEnd,
        })
        .where(eq(accounts._id, account._id));
    }
    return null;
  },
});
