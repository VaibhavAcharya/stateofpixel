import { z } from "zod";

const sha256Hex = z.string();

const gitInfo = z.strictObject({
  commit: z.string(),
  commitMessage: z.string().optional(),
  branch: z.string(),
  baselineBranch: z.string(),
  prNumber: z.number().nullable().optional(),
  mergeBase: z.string().nullable().optional(),
  ancestors: z.array(z.string()),
});

export type GitInfo = z.infer<typeof gitInfo>;

const ciInfo = z.strictObject({
  provider: z.string().optional(),
  runUrl: z.string().optional(),
});

export const createBuildRequest = z.strictObject({
  buildName: z.string().optional(),
  nonce: z.string(),
  previousNonces: z.array(z.string()).optional(),
  shard: z.strictObject({
    index: z.number().nullable(),
    total: z.number().nullable(),
  }),
  subset: z.boolean().optional(),
  git: gitInfo,
  ci: ciInfo.optional(),
  snapshots: z.array(
    z.strictObject({
      name: z.string(),
      hash: sha256Hex,
      bytes: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export type CreateBuildRequest = z.infer<typeof createBuildRequest>;

export const upload = z.strictObject({
  hash: sha256Hex,
  storageId: z.string(),
  kind: z.enum(["screenshot", "diff"]),
  width: z.number(),
  height: z.number(),
});

export const snapshotResult = z.strictObject({
  name: z.string(),
  hash: sha256Hex,
  status: z.enum(["unchanged", "changed", "added", "failed"]),
  diffHash: sha256Hex.optional(),
  diffRatio: z.number().optional(),
  diffPixels: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const completeShardRequest = z.strictObject({
  uploads: z.array(upload),
  results: z.array(snapshotResult),
  errors: z.array(z.string()).optional(),
});

export const uploadUrlsRequest = z.strictObject({ hashes: z.array(sha256Hex) });

export const finalizeRequest = z.strictObject({
  buildName: z.string().optional(),
  nonce: z.string(),
  previousNonces: z.array(z.string()).optional(),
  skipIfEmpty: z.boolean().optional(),
  git: gitInfo.optional(),
  ci: ciInfo.optional(),
});

export type FinalizeRequest = z.infer<typeof finalizeRequest>;
