import * as limits from "@stateofpixel/backend/limits";
import { PLAN_STORAGE_LIMIT_BYTES } from "@stateofpixel/backend/storage";

const MB = 1024 ** 2;
const GB = 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const count = (value: number) => value.toLocaleString("en-US");

export const facts = {
  snapshotsPerBuild: count(limits.MAX_SNAPSHOTS_PER_BUILD),
  shardsPerBuild: count(limits.MAX_SHARDS),
  imageSize: `${limits.MAX_IMAGE_BYTES / MB} MB`,
  imageDimensions: `${count(limits.MAX_IMAGE_WIDTH)} x ${count(limits.MAX_IMAGE_HEIGHT)} px`,
  snapshotNameLength: `${count(limits.MAX_SNAPSHOT_NAME_LENGTH)} characters`,
  metadataSize: `${limits.MAX_METADATA_BYTES / 1024} KB`,
  buildExpiryMinutes: limits.BUILD_EXPIRY_MS / 60_000,
  dailyBuilds: `${count(limits.DAILY_BUILDS)} a day`,
  dailyUploads: `${limits.DAILY_UPLOAD_BYTES / GB} GB a day`,
  requestsPerMinute: `${count(limits.CI_REQUESTS_PER_MINUTE)} a minute`,
  ancestors: limits.MAX_ANCESTORS,
  retentionDays: limits.DEFAULT_RETENTION_DAYS,
  minRetentionDays: limits.MIN_RETENTION_DAYS,
  maxRetentionDays: limits.MAX_RETENTION_DAYS,
  storageWarning: `${limits.STORAGE_WARNING_SHARE * 100}%`,
  graceDays: limits.STORAGE_GRACE_MS / DAY_MS,
  diffThreshold: limits.DEFAULT_DIFF_THRESHOLD,
  freeStorage: `${PLAN_STORAGE_LIMIT_BYTES.free / GB} GB`,
};
