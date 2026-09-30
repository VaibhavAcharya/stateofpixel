import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { getStore } from "@netlify/blobs";
import pg from "pg";
import { encrypt } from "../src/lib/secrets.ts";

const BUILD_EXPIRY_MS = 60 * 60 * 1000;
const BATCH_SIZE = 500;

type Row = Record<string, unknown>;

const { values } = parseArgs({
  options: { export: { type: "string" }, "dry-run": { type: "boolean" } },
});
const exportDir = values.export;
if (exportDir === undefined) {
  throw new Error(
    "Usage: node scripts/import-convex.ts --export <unzipped export dir>",
  );
}
const dryRun = values["dry-run"] === true;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const connectionSecret = requiredEnv("CONNECTION_SECRET");
const pool = new pg.Pool({ connectionString: requiredEnv("DATABASE_URL") });
const images = getStore({
  name: "images",
  siteID: requiredEnv("NETLIFY_SITE_ID"),
  token: requiredEnv("NETLIFY_AUTH_TOKEN"),
  consistency: "strong",
});

async function* documents(table: string): AsyncGenerator<Row> {
  const path = join(exportDir as string, table, "documents.jsonl");
  if (!existsSync(path)) {
    console.warn(`No ${table} in the export`);
    return;
  }
  for await (const line of createInterface({ input: createReadStream(path) })) {
    if (line.trim() !== "") {
      yield JSON.parse(line) as Row;
    }
  }
}

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function base(doc: Row): Row {
  return {
    id: doc._id,
    createdAt: doc._creationTime,
  };
}

function pick(doc: Row, keys: string[]): Row {
  return Object.fromEntries(keys.map((key) => [key, doc[key] ?? null]));
}

const COLUMN_NAMES: Record<string, string> = {
  diffIncludeAA: "diff_include_aa",
};

async function insert(table: string, rows: Row[]) {
  if (rows.length === 0 || dryRun) {
    return;
  }
  const keys = Object.keys(rows[0] as Row);
  const columns = keys
    .map((key) => `"${COLUMN_NAMES[key] ?? snakeCase(key)}"`)
    .join(", ");
  const params: unknown[] = [];
  const tuples = rows.map(
    (row) =>
      `(${keys
        .map((key) => {
          const value = row[key];
          params.push(
            value !== null && typeof value === "object" && !Array.isArray(value)
              ? JSON.stringify(value)
              : value,
          );
          return `$${params.length}`;
        })
        .join(", ")})`,
  );
  await pool.query(
    `insert into "${table}" (${columns}) values ${tuples.join(", ")} on conflict do nothing`,
    params,
  );
}

async function copy(
  source: string,
  target: string,
  transform: (doc: Row) => Row | null | Promise<Row | null>,
) {
  let batch: Row[] = [];
  let count = 0;
  for await (const doc of documents(source)) {
    const row = await transform(doc);
    if (row !== null) {
      batch.push(row);
      count++;
    }
    if (batch.length === BATCH_SIZE) {
      await insert(target, batch);
      batch = [];
    }
  }
  await insert(target, batch);
  console.log(`${target}: ${count}`);
}

await copy("users", "users", (doc) => ({
  ...base(doc),
  ...pick(doc, ["name", "image", "email", "lastSeenAt"]),
  identityId: null,
}));

await copy("users", "connections", async (doc) => ({
  id: `github-${doc._id}`,
  createdAt: doc._creationTime,
  userId: doc._id,
  provider: "github",
  providerUserId: doc.githubUserId,
  login: doc.login,
  accessToken: await encrypt(connectionSecret, doc.githubToken as string),
}));

await copy("accounts", "accounts", (doc) => ({
  ...base(doc),
  provider: "github",
  providerAccountId: doc.githubAccountId,
  ...pick(doc, [
    "login",
    "type",
    "installationId",
    "plan",
    "storageLimitBytes",
    "storageBytes",
    "overLimitSince",
    "billingCustomerId",
    "billingSubscriptionId",
    "billingStatus",
    "billingInterval",
    "billingPeriodEndsAt",
    "billingCancelsAtPeriodEnd",
    "deletedAt",
  ]),
}));

await copy("accountMembers", "account_members", (doc) => ({
  ...base(doc),
  ...pick(doc, ["userId", "accountId", "role"]),
}));

await copy("projects", "projects", (doc) => ({
  ...base(doc),
  provider: "github",
  providerRepoId: doc.githubRepoId,
  ...pick(doc, [
    "accountId",
    "owner",
    "name",
    "private",
    "defaultBranch",
    "autoApproveBranches",
    "diffThreshold",
    "diffIncludeAA",
    "prRetentionDays",
    "nextBuildNumber",
    "lastBuildAt",
    "archivedAt",
  ]),
}));

await copy("projectTokens", "project_tokens", (doc) => ({
  ...base(doc),
  ...pick(doc, [
    "projectId",
    "name",
    "tokenHash",
    "createdBy",
    "lastUsedAt",
    "revokedAt",
  ]),
}));

const expiryJobs: Row[] = [];

await copy("builds", "builds", (doc) => {
  if (doc.status === "pending") {
    expiryJobs.push({
      id: `expire-${doc._id}`,
      name: "builds.expire",
      args: { buildId: doc._id },
      runAt: Math.max(
        Date.now(),
        Math.round(doc._creationTime as number) + BUILD_EXPIRY_MS,
      ),
    });
  }
  return {
    ...base(doc),
    ...pick(doc, [
      "projectId",
      "number",
      "buildName",
      "commitSha",
      "commitMessage",
      "branch",
      "baselineBranch",
      "mergeBaseSha",
      "ancestors",
      "prNumber",
      "prClosedAt",
      "mergedPrNumber",
      "nonce",
      "shardsTotal",
      "doneShardIndexes",
      "shardsJoined",
      "subset",
      "status",
      "conclusion",
      "autoApproved",
      "fullRows",
      "baselineBuildId",
      "supersededById",
      "counts",
      "storageBlocked",
      "githubCheckRunId",
      "checkVersion",
      "checkOutOfSync",
      "checkSyncScheduledAt",
      "ciProvider",
      "ciRunUrl",
      "finalizedAt",
    ]),
    expiryJobId: null,
  };
});

await insert("jobs", expiryJobs);
console.log(`jobs: ${expiryJobs.length}`);

await copy("deletedBuilds", "deleted_builds", (doc) => ({
  ...base(doc),
  ...pick(doc, [
    "projectId",
    "number",
    "branch",
    "prNumber",
    "reason",
    "retentionDays",
  ]),
}));

await copy("snapshots", "snapshots", (doc) => ({
  ...base(doc),
  ...pick(doc, [
    "buildId",
    "shardIndex",
    "name",
    "imageId",
    "baselineSnapshotId",
    "baselineImageId",
    "diffImageId",
    "diffStatus",
    "diffRatio",
    "diffPixels",
    "reviewState",
    "metadata",
  ]),
}));

await copy("reviews", "reviews", (doc) => ({
  ...base(doc),
  ...pick(doc, [
    "snapshotId",
    "buildId",
    "userId",
    "action",
    "source",
    "sourceReviewId",
    "comment",
  ]),
}));

await copy("approvedImages", "approved_images", (doc) => ({
  ...base(doc),
  ...pick(doc, ["projectId", "buildName", "prNumber", "imageId", "reviewId"]),
}));

const storageFiles = new Map(
  existsSync(join(exportDir, "_storage"))
    ? (await readdir(join(exportDir, "_storage")))
        .filter((file) => file !== "documents.jsonl")
        .map((file) => [file.split(".")[0] as string, file])
    : [],
);

await copy("images", "images", async (doc) => {
  let blobKey = doc.blobKey as string | undefined;
  if (blobKey === undefined) {
    const file = storageFiles.get(doc.storageId as string);
    const path = join(exportDir, "_storage", file ?? "");
    if (file === undefined) {
      console.warn(`Missing file ${doc.storageId} for image ${doc._id}`);
      return null;
    }
    blobKey = `${doc.accountId}/${crypto.randomUUID()}`;
    if (!dryRun) {
      const bytes = await readFile(path);
      await images.set(blobKey, new Blob([bytes], { type: "image/png" }));
    }
  }
  return {
    ...base(doc),
    ...pick(doc, [
      "accountId",
      "hash",
      "kind",
      "bytes",
      "width",
      "height",
      "lastReferencedAt",
      "projectId",
      "baseline",
    ]),
    blobKey,
  };
});

await copy("usageDaily", "usage_daily", (doc) => ({
  ...base(doc),
  ...pick(doc, [
    "accountId",
    "projectId",
    "day",
    "baselineBytes",
    "prBytes",
    "diffBytes",
    "builds",
    "snapshots",
    "uploadedImages",
  ]),
}));

await copy("repoPermissions", "repo_permissions", (doc) => ({
  ...base(doc),
  ...pick(doc, ["userId", "projectId", "permission", "orgOwner", "checkedAt"]),
  freshness: "expired",
  freshnessJobId: null,
}));

await copy("githubEvents", "github_events", (doc) => ({
  ...base(doc),
  ...pick(doc, ["deliveryId", "event"]),
}));

await pool.end();
