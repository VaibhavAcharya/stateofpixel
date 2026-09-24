import { type Infer, v } from "convex/values";

const sha256Hex = v.string();

export const createBuildRequest = v.object({
  buildName: v.optional(v.string()),
  nonce: v.string(),
  shard: v.object({ index: v.number(), total: v.union(v.number(), v.null()) }),
  subset: v.optional(v.boolean()),
  git: v.object({
    commit: v.string(),
    commitMessage: v.optional(v.string()),
    branch: v.string(),
    baselineBranch: v.string(),
    prNumber: v.optional(v.union(v.number(), v.null())),
    mergeBase: v.optional(v.union(v.string(), v.null())),
    ancestors: v.array(v.string()),
  }),
  ci: v.optional(
    v.object({
      provider: v.optional(v.string()),
      runUrl: v.optional(v.string()),
    }),
  ),
  snapshots: v.array(
    v.object({
      name: v.string(),
      hash: sha256Hex,
      bytes: v.optional(v.number()),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      metadata: v.optional(v.record(v.string(), v.any())),
    }),
  ),
});

export type CreateBuildRequest = Infer<typeof createBuildRequest>;

export const upload = v.object({
  hash: sha256Hex,
  storageId: v.string(),
  kind: v.union(v.literal("screenshot"), v.literal("diff")),
  width: v.number(),
  height: v.number(),
});

export const snapshotResult = v.object({
  name: v.string(),
  hash: sha256Hex,
  status: v.union(
    v.literal("unchanged"),
    v.literal("changed"),
    v.literal("added"),
    v.literal("failed"),
  ),
  diffHash: v.optional(sha256Hex),
  diffRatio: v.optional(v.number()),
  diffPixels: v.optional(v.number()),
  metadata: v.optional(v.record(v.string(), v.any())),
});

export const completeShardRequest = v.object({
  uploads: v.array(upload),
  results: v.array(snapshotResult),
  errors: v.optional(v.array(v.string())),
});

export type CompleteShardRequest = Infer<typeof completeShardRequest>;

export const uploadUrlsRequest = v.object({ hashes: v.array(sha256Hex) });

export const finalizeRequest = v.object({
  buildName: v.optional(v.string()),
  nonce: v.string(),
});
