import { and, asc, desc, eq, ilike, isNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import type { Doc } from "./dataModel.ts";
import { first } from "./db/index.ts";
import { PLAN_STORAGE_LIMIT_BYTES, withStorageBytes } from "./lib/storage.ts";
import {
  accountMembers,
  type accountRole,
  accounts,
  builds,
  connections,
  plan,
  projects as projectsTable,
  type storageUsage,
  users,
} from "./schema.ts";
import {
  internalMutation,
  paginate,
  paginationOptsValidator,
  type QueryCtx,
  query,
} from "./server.ts";

async function toProjectRow(ctx: QueryCtx, project: Doc<"projects">) {
  const build = first(
    await ctx.db
      .select()
      .from(builds)
      .where(eq(builds.projectId, project._id))
      .orderBy(desc(builds.number), desc(builds._creationTime))
      .limit(1),
  );
  return {
    owner: project.owner,
    name: project.name,
    private: project.private,
    latestBuild:
      build === null
        ? null
        : {
            number: build.number,
            branch: build.branch,
            status: build.status,
            conclusion: build.conclusion ?? null,
            counts: build.counts,
            storageBlocked: build.storageBlocked,
            createdAt: build._creationTime,
          },
  };
}

export async function findMembership(ctx: QueryCtx, login: string) {
  const { userId } = ctx;
  if (userId === null) {
    return null;
  }
  const user = first(
    await ctx.db
      .select({ _id: users._id, login: connections.login })
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
  const account = first(
    await ctx.db
      .select()
      .from(accounts)
      .where(eq(accounts.login, login))
      .orderBy(asc(accounts._creationTime), asc(accounts._id))
      .limit(1),
  );
  if (user === null || account === null) {
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
  return membership === null ? null : { account, user, membership };
}

export async function findMemberAccount(ctx: QueryCtx, login: string) {
  return (await findMembership(ctx, login))?.account ?? null;
}

export function memberRole(
  account: Doc<"accounts">,
  user: { login: string | null },
  membership: Doc<"accountMembers">,
): z.infer<typeof accountRole> | null {
  if (account.type === "user") {
    return user.login === account.login ? "owner" : "member";
  }
  return membership.role ?? null;
}

export const subscription = z
  .object({
    id: z.string(),
    status: z.string(),
    interval: z.enum(["monthly", "yearly"]).nullable(),
    periodEndsAt: z.number().nullable(),
    cancelsAtPeriodEnd: z.boolean(),
  })
  .nullable();

export function toSubscription(
  account: Doc<"accounts">,
): z.infer<typeof subscription> {
  return account.billingSubscriptionId === null
    ? null
    : {
        id: account.billingSubscriptionId,
        status: account.billingStatus ?? "active",
        interval: account.billingInterval ?? null,
        periodEndsAt: account.billingPeriodEndsAt ?? null,
        cancelsAtPeriodEnd: account.billingCancelsAtPeriodEnd ?? false,
      };
}

export const home = query({
  args: { login: z.string() },
  handler: async (ctx, { login }) => {
    const found = await findMembership(ctx, login);
    if (found === null) {
      return null;
    }
    const { account } = found;
    return {
      login: account.login,
      type: account.type,
      installationSettingsUrl:
        account.installationId === null
          ? null
          : account.type === "org"
            ? `https://github.com/organizations/${account.login}/settings/installations/${account.installationId}`
            : `https://github.com/settings/installations/${account.installationId}`,
      storage: toStorageUsage(account),
      subscription: toSubscription(account),
      billingCustomer: account.billingCustomerId !== null,
      role: memberRole(account, found.user, found.membership),
    };
  },
});

export function toStorageUsage(
  account: Doc<"accounts">,
): z.infer<typeof storageUsage> {
  return {
    plan: account.plan,
    storageBytes: account.storageBytes,
    storageLimitBytes: account.storageLimitBytes,
    overLimitSince: account.overLimitSince ?? undefined,
  };
}

export const setPlan = internalMutation({
  args: {
    login: z.string(),
    plan,
    storageLimitBytes: z.number().optional(),
  },
  handler: async (ctx, args) => {
    const account = first(
      await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.login, args.login))
        .orderBy(asc(accounts._creationTime), asc(accounts._id))
        .limit(1),
    );
    if (account === null) {
      throw new Error(`No account ${args.login}`);
    }
    const storageLimitBytes =
      args.plan === "custom"
        ? args.storageLimitBytes
        : PLAN_STORAGE_LIMIT_BYTES[args.plan];
    if (storageLimitBytes === undefined) {
      throw new Error("A custom plan needs storageLimitBytes");
    }
    await ctx.db
      .update(accounts)
      .set(planFields(account, args.plan, storageLimitBytes))
      .where(eq(accounts._id, account._id));
    return null;
  },
});

export function planFields(
  account: Doc<"accounts">,
  plan: Doc<"accounts">["plan"],
  storageLimitBytes: number = PLAN_STORAGE_LIMIT_BYTES[
    plan as keyof typeof PLAN_STORAGE_LIMIT_BYTES
  ],
) {
  return {
    plan,
    storageLimitBytes,
    ...withStorageBytes(
      { ...account, storageLimitBytes },
      account.storageBytes,
      Date.now(),
    ),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const projects = query({
  args: {
    login: z.string(),
    search: z.string().optional(),
    sort: z.enum(["name", "updated"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const account = await findMemberAccount(ctx, args.login);
    if (account === null) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const search = args.search?.trim() ?? "";
    const conditions: SQL[] = [
      eq(projectsTable.accountId, account._id),
      isNull(projectsTable.archivedAt),
    ];
    let orderBy: SQL[];
    if (search !== "") {
      conditions.push(ilike(projectsTable.name, `%${escapeLike(search)}%`));
      orderBy = [asc(projectsTable.name), asc(projectsTable._creationTime)];
    } else if (args.sort === "updated") {
      const order = args.order ?? "desc";
      const direction = order === "asc" ? asc : desc;
      orderBy = [
        order === "asc"
          ? sql`${projectsTable.lastBuildAt} asc nulls first`
          : sql`${projectsTable.lastBuildAt} desc nulls last`,
        direction(projectsTable._creationTime),
      ];
    } else {
      const direction = (args.order ?? "asc") === "asc" ? asc : desc;
      orderBy = [
        direction(projectsTable.name),
        direction(projectsTable._creationTime),
      ];
    }
    const page = await paginate(args.paginationOpts, (limit, offset) =>
      ctx.db
        .select()
        .from(projectsTable)
        .where(and(...conditions))
        .orderBy(...orderBy, asc(projectsTable._id))
        .limit(limit)
        .offset(offset),
    );
    const rows = [];
    for (const project of page.page) {
      rows.push(await toProjectRow(ctx, project));
    }
    return { ...page, page: rows };
  },
});
