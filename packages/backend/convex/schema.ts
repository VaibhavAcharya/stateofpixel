import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const DEFAULT_BUILD_NAME = "default";

export const diffStatus = v.union(
  v.literal("unchanged"),
  v.literal("changed"),
  v.literal("added"),
  v.literal("removed"),
  v.literal("failed"),
);

export const reviewState = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const buildStatus = v.union(
  v.literal("pending"),
  v.literal("finalized"),
  v.literal("expired"),
  v.literal("error"),
);

export const buildConclusion = v.union(
  v.literal("no_changes"),
  v.literal("changes"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const plan = v.union(
  v.literal("free"),
  v.literal("25gb"),
  v.literal("100gb"),
  v.literal("500gb"),
  v.literal("custom"),
);

export const accountRole = v.union(v.literal("owner"), v.literal("member"));

export const storageUsage = v.object({
  plan,
  storageBytes: v.number(),
  storageLimitBytes: v.number(),
  overLimitSince: v.optional(v.number()),
});

export const repoPermission = v.union(
  v.literal("none"),
  v.literal("read"),
  v.literal("write"),
  v.literal("admin"),
);

export const buildCounts = v.object({
  unchanged: v.number(),
  changed: v.number(),
  added: v.number(),
  removed: v.number(),
  failed: v.number(),
  pending: v.number(),
  approved: v.number(),
  rejected: v.number(),
});

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    githubUserId: v.number(),
    login: v.string(),
    githubToken: v.string(),
    lastSeenAt: v.number(),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_githubUserId", ["githubUserId"]),

  accounts: defineTable({
    githubAccountId: v.number(),
    login: v.string(),
    type: v.union(v.literal("user"), v.literal("org")),
    installationId: v.optional(v.number()),
    plan,
    storageLimitBytes: v.number(),
    storageBytes: v.number(),
    overLimitSince: v.optional(v.number()),
    billingCustomerId: v.optional(v.string()),
    billingSubscriptionId: v.optional(v.string()),
    billingStatus: v.optional(v.string()),
    billingPeriodEndsAt: v.optional(v.number()),
    billingCancelsAtPeriodEnd: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_githubAccountId", ["githubAccountId"])
    .index("by_login", ["login"])
    .index("by_installationId", ["installationId"]),

  accountMembers: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    role: v.optional(accountRole),
  })
    .index("by_userId", ["userId"])
    .index("by_accountId_and_userId", ["accountId", "userId"]),

  projects: defineTable({
    accountId: v.id("accounts"),
    githubRepoId: v.number(),
    owner: v.string(),
    name: v.string(),
    private: v.boolean(),
    defaultBranch: v.string(),
    autoApproveBranches: v.array(v.string()),
    diffThreshold: v.number(),
    diffIncludeAA: v.boolean(),
    prRetentionDays: v.number(),
    nextBuildNumber: v.number(),
    lastBuildAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_accountId", ["accountId"])
    .index("by_accountId_and_name", ["accountId", "name"])
    .index("by_accountId_and_lastBuildAt", ["accountId", "lastBuildAt"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["accountId"],
    })
    .index("by_githubRepoId", ["githubRepoId"])
    .index("by_owner_and_name", ["owner", "name"]),

  projectTokens: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    tokenHash: v.string(),
    createdBy: v.id("users"),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_tokenHash", ["tokenHash"]),

  builds: defineTable({
    projectId: v.id("projects"),
    number: v.number(),
    buildName: v.string(),
    commitSha: v.string(),
    commitMessage: v.string(),
    branch: v.string(),
    baselineBranch: v.string(),
    mergeBaseSha: v.optional(v.string()),
    ancestors: v.array(v.string()),
    prNumber: v.optional(v.number()),
    prClosedAt: v.optional(v.number()),
    mergedPrNumber: v.optional(v.number()),
    nonce: v.string(),
    shardsTotal: v.optional(v.number()),
    doneShardIndexes: v.array(v.number()),
    shardsJoined: v.optional(v.number()),
    subset: v.boolean(),
    status: buildStatus,
    conclusion: v.optional(buildConclusion),
    autoApproved: v.boolean(),
    fullRows: v.boolean(),
    baselineBuildId: v.optional(v.id("builds")),
    supersededById: v.optional(v.id("builds")),
    counts: buildCounts,
    storageBlocked: v.boolean(),
    expiryJobId: v.optional(v.id("_scheduled_functions")),
    githubCheckRunId: v.optional(v.number()),
    checkVersion: v.number(),
    checkOutOfSync: v.boolean(),
    checkSyncScheduledAt: v.optional(v.number()),
    ciProvider: v.optional(v.string()),
    ciRunUrl: v.optional(v.string()),
    finalizedAt: v.optional(v.number()),
  })
    .index("by_projectId_and_number", ["projectId", "number"])
    .index("by_projectId_and_buildName_and_nonce", [
      "projectId",
      "buildName",
      "nonce",
    ])
    .index("by_projectId_and_buildName_and_commitSha", [
      "projectId",
      "buildName",
      "commitSha",
    ])
    .index("by_projectId_and_buildName_and_prNumber", [
      "projectId",
      "buildName",
      "prNumber",
    ])
    .index("by_projectId_and_branch", ["projectId", "branch"])
    .index("by_projectId_and_prNumber", ["projectId", "prNumber"])
    .index("by_projectId_and_status_and_conclusion", [
      "projectId",
      "status",
      "conclusion",
    ])
    .index("by_checkOutOfSync", ["checkOutOfSync"])
    .index("by_baselineBuildId", ["baselineBuildId"]),

  snapshots: defineTable({
    buildId: v.id("builds"),
    shardIndex: v.number(),
    name: v.string(),
    imageId: v.optional(v.id("images")),
    baselineSnapshotId: v.optional(v.id("snapshots")),
    baselineImageId: v.optional(v.id("images")),
    diffImageId: v.optional(v.id("images")),
    diffStatus,
    diffRatio: v.optional(v.number()),
    diffPixels: v.optional(v.number()),
    reviewState,
    metadata: v.record(v.string(), v.any()),
  })
    .index("by_buildId_and_name", ["buildId", "name"])
    .index("by_buildId_and_diffStatus_and_name", [
      "buildId",
      "diffStatus",
      "name",
    ])
    .index("by_imageId", ["imageId"])
    .index("by_baselineImageId", ["baselineImageId"])
    .index("by_diffImageId", ["diffImageId"]),

  reviews: defineTable({
    snapshotId: v.id("snapshots"),
    buildId: v.id("builds"),
    userId: v.optional(v.id("users")),
    action: v.union(
      v.literal("approve"),
      v.literal("reject"),
      v.literal("undo"),
    ),
    source: v.union(
      v.literal("user"),
      v.literal("approve_all"),
      v.literal("carry_over"),
      v.literal("auto_branch"),
      v.literal("orphan"),
    ),
    sourceReviewId: v.optional(v.id("reviews")),
    comment: v.optional(v.string()),
  })
    .index("by_snapshotId", ["snapshotId"])
    .index("by_buildId", ["buildId"]),

  approvedImages: defineTable({
    projectId: v.id("projects"),
    buildName: v.string(),
    prNumber: v.number(),
    imageId: v.id("images"),
    reviewId: v.id("reviews"),
  }).index("by_projectId_and_buildName_and_prNumber_and_imageId", [
    "projectId",
    "buildName",
    "prNumber",
    "imageId",
  ]),

  images: defineTable({
    accountId: v.id("accounts"),
    hash: v.string(),
    kind: v.union(v.literal("screenshot"), v.literal("diff")),
    bytes: v.number(),
    width: v.number(),
    height: v.number(),
    store: v.union(v.literal("convex"), v.literal("r2")),
    storageId: v.optional(v.id("_storage")),
    r2Key: v.optional(v.string()),
    lastReferencedAt: v.number(),
  })
    .index("by_accountId_and_hash", ["accountId", "hash"])
    .index("by_storageId", ["storageId"]),

  usageDaily: defineTable({
    accountId: v.id("accounts"),
    projectId: v.id("projects"),
    day: v.string(),
    baselineBytes: v.number(),
    prBytes: v.number(),
    diffBytes: v.number(),
    builds: v.number(),
    snapshots: v.number(),
    uploadedImages: v.number(),
  })
    .index("by_projectId_and_day", ["projectId", "day"])
    .index("by_accountId_and_day", ["accountId", "day"]),

  repoPermissions: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    permission: repoPermission,
    orgOwner: v.boolean(),
    checkedAt: v.number(),
    freshness: v.optional(
      v.union(v.literal("fresh"), v.literal("stale"), v.literal("expired")),
    ),
    freshnessJobId: v.optional(v.id("_scheduled_functions")),
  }).index("by_userId_and_projectId", ["userId", "projectId"]),

  githubEvents: defineTable({
    deliveryId: v.string(),
    event: v.string(),
  }).index("by_deliveryId", ["deliveryId"]),
});
