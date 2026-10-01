import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const DEFAULT_BUILD_NAME = "default";

export const diffStatus = z.enum([
  "unchanged",
  "changed",
  "added",
  "removed",
  "failed",
]);

export const reviewState = z.enum(["none", "pending", "approved", "rejected"]);

export const buildStatus = z.enum(["pending", "finalized", "expired", "error"]);

export const buildConclusion = z.enum([
  "no_changes",
  "changes",
  "approved",
  "rejected",
]);

export const plan = z.enum(["free", "25gb", "100gb", "500gb", "custom"]);

export const accountRole = z.enum(["owner", "member"]);

export const provider = z.enum(["github"]);

export const storageUsage = z.object({
  plan,
  storageBytes: z.number(),
  storageLimitBytes: z.number(),
  overLimitSince: z.number().optional(),
});

export const repoPermission = z.enum(["none", "read", "write", "admin"]);

export const buildCounts = z.object({
  unchanged: z.number(),
  changed: z.number(),
  added: z.number(),
  removed: z.number(),
  failed: z.number(),
  pending: z.number(),
  approved: z.number(),
  rejected: z.number(),
});

export type Provider = z.infer<typeof provider>;
export type BuildCounts = z.infer<typeof buildCounts>;

const id = () => text("id").primaryKey().default(sql`gen_random_uuid()::text`);
let lastCreationTime = 0;

export function nextCreationTime(): number {
  lastCreationTime = Math.max(Date.now(), lastCreationTime + 0.001);
  return lastCreationTime;
}

const creationTime = () =>
  doublePrecision("created_at")
    .notNull()
    .default(sql`extract(epoch from clock_timestamp()) * 1000`)
    .$defaultFn(nextCreationTime);
const time = () => bigint({ mode: "number" });

export const users = pgTable(
  "users",
  {
    _id: id(),
    _creationTime: creationTime(),
    identityId: text(),
    name: text(),
    image: text(),
    email: text(),
    lastSeenAt: time().notNull(),
  },
  (table) => [uniqueIndex().on(table.identityId)],
);

export const connections = pgTable(
  "connections",
  {
    _id: id(),
    _creationTime: creationTime(),
    userId: text().notNull(),
    provider: text().$type<Provider>().notNull(),
    providerUserId: bigint({ mode: "number" }).notNull(),
    login: text().notNull(),
    accessToken: text().notNull(),
    accessTokenExpiresAt: time(),
    refreshToken: text(),
    refreshTokenExpiresAt: time(),
  },
  (table) => [
    uniqueIndex().on(table.provider, table.providerUserId),
    uniqueIndex().on(table.userId, table.provider),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    _id: id(),
    _creationTime: creationTime(),
    provider: text().$type<Provider>().notNull().default("github"),
    providerAccountId: bigint({ mode: "number" }).notNull(),
    login: text().notNull(),
    type: text().$type<"user" | "org">().notNull(),
    installationId: bigint({ mode: "number" }),
    plan: text().$type<z.infer<typeof plan>>().notNull(),
    storageLimitBytes: bigint({ mode: "number" }).notNull(),
    storageBytes: bigint({ mode: "number" }).notNull(),
    overLimitSince: time(),
    billingCustomerId: text(),
    billingSubscriptionId: text(),
    billingStatus: text(),
    billingInterval: text().$type<"monthly" | "yearly">(),
    billingPeriodEndsAt: time(),
    billingCancelsAtPeriodEnd: boolean(),
    deletedAt: time(),
  },
  (table) => [
    index().on(table.provider, table.providerAccountId),
    index().on(table.login),
    index().on(table.installationId),
  ],
);

export const accountMembers = pgTable(
  "account_members",
  {
    _id: id(),
    _creationTime: creationTime(),
    userId: text().notNull(),
    accountId: text().notNull(),
    role: text().$type<z.infer<typeof accountRole>>(),
  },
  (table) => [
    index().on(table.userId),
    uniqueIndex().on(table.accountId, table.userId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    _id: id(),
    _creationTime: creationTime(),
    accountId: text().notNull(),
    provider: text().$type<Provider>().notNull().default("github"),
    providerRepoId: bigint({ mode: "number" }).notNull(),
    owner: text().notNull(),
    name: text().notNull(),
    private: boolean().notNull(),
    defaultBranch: text().notNull(),
    autoApproveBranches: text().array().notNull(),
    diffThreshold: doublePrecision().notNull(),
    diffIncludeAA: boolean("diff_include_aa").notNull(),
    prRetentionDays: integer().notNull(),
    nextBuildNumber: integer().notNull(),
    lastBuildAt: time(),
    archivedAt: time(),
  },
  (table) => [
    index().on(table.accountId, table.name),
    index().on(table.accountId, table.lastBuildAt),
    index().on(table.provider, table.providerRepoId),
    index().on(table.owner, table.name),
  ],
);

export const projectTokens = pgTable(
  "project_tokens",
  {
    _id: id(),
    _creationTime: creationTime(),
    projectId: text().notNull(),
    name: text().notNull(),
    tokenHash: text().notNull(),
    createdBy: text().notNull(),
    lastUsedAt: time(),
    revokedAt: time(),
  },
  (table) => [index().on(table.projectId), uniqueIndex().on(table.tokenHash)],
);

export const builds = pgTable(
  "builds",
  {
    _id: id(),
    _creationTime: creationTime(),
    projectId: text().notNull(),
    number: integer().notNull(),
    buildName: text().notNull(),
    commitSha: text().notNull(),
    commitMessage: text().notNull(),
    branch: text().notNull(),
    baselineBranch: text().notNull(),
    mergeBaseSha: text(),
    ancestors: text().array().notNull(),
    prNumber: integer(),
    prClosedAt: time(),
    prMergedAt: time(),
    mergedPrNumber: integer(),
    nonce: text().notNull(),
    shardsTotal: integer(),
    doneShardIndexes: integer().array().notNull(),
    shardsJoined: integer(),
    subset: boolean().notNull(),
    status: text().$type<z.infer<typeof buildStatus>>().notNull(),
    conclusion: text().$type<z.infer<typeof buildConclusion>>(),
    autoApproved: boolean().notNull(),
    fullRows: boolean().notNull(),
    baselineBuildId: text(),
    supersededById: text(),
    counts: jsonb().$type<BuildCounts>().notNull(),
    storageBlocked: boolean().notNull(),
    expiryJobId: text(),
    githubCheckRunId: bigint({ mode: "number" }),
    checkVersion: integer().notNull(),
    checkOutOfSync: boolean().notNull(),
    checkSyncScheduledAt: time(),
    ciProvider: text(),
    ciRunUrl: text(),
    finalizedAt: time(),
  },
  (table) => [
    uniqueIndex().on(table.projectId, table.number),
    index().on(table.projectId, table.buildName, table.nonce),
    index().on(table.projectId, table.buildName, table.commitSha),
    index().on(table.projectId, table.buildName, table.prNumber),
    index().on(table.projectId, table.branch),
    index().on(table.projectId, table.prNumber),
    index().on(table.projectId, table.status, table.conclusion),
    index().on(table.checkOutOfSync).where(sql`${table.checkOutOfSync}`),
    index().on(table.baselineBuildId),
  ],
);

export const deletedBuilds = pgTable(
  "deleted_builds",
  {
    _id: id(),
    _creationTime: creationTime(),
    projectId: text().notNull(),
    number: integer().notNull(),
    branch: text().notNull(),
    prNumber: integer(),
    reason: text().$type<"pr_closed" | "branch_inactive">().notNull(),
    retentionDays: integer().notNull(),
  },
  (table) => [index().on(table.projectId, table.number)],
);

export const snapshots = pgTable(
  "snapshots",
  {
    _id: id(),
    _creationTime: creationTime(),
    buildId: text().notNull(),
    shardIndex: integer().notNull(),
    name: text().notNull(),
    imageId: text(),
    baselineSnapshotId: text(),
    baselineImageId: text(),
    diffImageId: text(),
    diffStatus: text().$type<z.infer<typeof diffStatus>>().notNull(),
    diffRatio: doublePrecision(),
    diffPixels: bigint({ mode: "number" }),
    reviewState: text().$type<z.infer<typeof reviewState>>().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    check(
      "snapshots_diff_status_check",
      sql`${table.diffStatus} in (${sql.raw(diffStatus.options.map((status) => `'${status}'`).join(", "))})`,
    ),
    index().on(table.buildId, table.name),
    index().on(table.buildId, table.diffStatus, table.name),
    index().on(table.imageId),
    index().on(table.baselineImageId),
    index().on(table.diffImageId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    _id: id(),
    _creationTime: creationTime(),
    snapshotId: text().notNull(),
    buildId: text().notNull(),
    userId: text(),
    action: text().$type<"approve" | "reject" | "undo">().notNull(),
    source: text()
      .$type<"user" | "approve_all" | "carry_over" | "auto_branch" | "orphan">()
      .notNull(),
    sourceReviewId: text(),
    comment: text(),
  },
  (table) => [index().on(table.snapshotId), index().on(table.buildId)],
);

export const approvedImages = pgTable(
  "approved_images",
  {
    _id: id(),
    _creationTime: creationTime(),
    projectId: text().notNull(),
    buildName: text().notNull(),
    prNumber: integer().notNull(),
    imageId: text().notNull(),
    reviewId: text().notNull(),
  },
  (table) => [
    index().on(table.projectId, table.buildName, table.prNumber, table.imageId),
  ],
);

export const images = pgTable(
  "images",
  {
    _id: id(),
    _creationTime: creationTime(),
    accountId: text().notNull(),
    hash: text().notNull(),
    kind: text().$type<"screenshot" | "diff">().notNull(),
    bytes: bigint({ mode: "number" }).notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    blobKey: text().notNull(),
    lastReferencedAt: time().notNull(),
    projectId: text(),
    baseline: boolean(),
  },
  (table) => [index().on(table.accountId, table.hash)],
);

export const usageDaily = pgTable(
  "usage_daily",
  {
    _id: id(),
    _creationTime: creationTime(),
    accountId: text().notNull(),
    projectId: text().notNull(),
    day: text().notNull(),
    baselineBytes: bigint({ mode: "number" }).notNull(),
    prBytes: bigint({ mode: "number" }).notNull(),
    diffBytes: bigint({ mode: "number" }).notNull(),
    builds: integer().notNull(),
    snapshots: integer().notNull(),
    uploadedImages: integer().notNull(),
  },
  (table) => [
    index().on(table.projectId, table.day),
    index().on(table.accountId, table.day),
  ],
);

export const repoPermissions = pgTable(
  "repo_permissions",
  {
    _id: id(),
    _creationTime: creationTime(),
    userId: text().notNull(),
    projectId: text().notNull(),
    permission: text().$type<z.infer<typeof repoPermission>>().notNull(),
    orgOwner: boolean().notNull(),
    checkedAt: time().notNull(),
    freshness: text().$type<"fresh" | "stale" | "expired">(),
    freshnessJobId: text(),
  },
  (table) => [uniqueIndex().on(table.userId, table.projectId)],
);

export const githubEvents = pgTable(
  "github_events",
  {
    _id: id(),
    _creationTime: creationTime(),
    deliveryId: text().notNull(),
    event: text().notNull(),
  },
  (table) => [uniqueIndex().on(table.deliveryId)],
);

export const jobs = pgTable(
  "jobs",
  {
    _id: id(),
    _creationTime: creationTime(),
    name: text().notNull(),
    args: jsonb().$type<unknown>().notNull(),
    runAt: time().notNull(),
    lockedUntil: time(),
    failedAt: time(),
    error: text(),
  },
  (table) => [index().on(table.runAt).where(sql`${table.failedAt} is null`)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    name: text().notNull(),
    key: text().notNull(),
    value: doublePrecision().notNull(),
    ts: time().notNull(),
  },
  (table) => [primaryKey({ columns: [table.name, table.key] })],
);
