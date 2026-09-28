import type { Id } from "../_generated/dataModel";
import { env } from "../_generated/server";
import { messages, sign, verify } from "./signing";

export const IMAGE_ROUTE = "/images/";
const BLOB_IMAGE_ROUTE = "/api/images/";
const UPLOAD_ROUTE = "/api/v1/uploads/";

const HOUR_MS = 60 * 60 * 1000;

export type ImageGrant = { exp: number; sig: string };

export function privateImageUrl(
  projectId: Id<"projects">,
  imageId: Id<"images">,
): string {
  return `${env.CONVEX_SITE_URL}${IMAGE_ROUTE}${projectId}/${imageId}`;
}

export function blobImageUrl(
  project: { _id: Id<"projects">; private: boolean },
  blobKey: string,
): string {
  const file = blobKey.replace("/", ".");
  return project.private
    ? `${env.SITE_URL}${BLOB_IMAGE_ROUTE}${project._id}/${file}`
    : `${env.SITE_URL}${BLOB_IMAGE_ROUTE}${file}`;
}

export async function blobUploadUrl(
  blobKey: string,
  hash: string,
  now: number,
): Promise<string> {
  const exp = now + HOUR_MS;
  const sig = await sign(
    env.IMAGE_URL_SECRET,
    messages.upload(blobKey, hash, exp),
  );
  return `${env.SITE_URL}${UPLOAD_ROUTE}${blobKey}?hash=${hash}&exp=${exp}&sig=${sig}`;
}

export async function blobDeleteUrl(
  blobKey: string,
  now: number,
): Promise<string> {
  const exp = now + HOUR_MS;
  const sig = await sign(env.IMAGE_URL_SECRET, messages.delete(blobKey, exp));
  return `${env.SITE_URL}${UPLOAD_ROUTE}${blobKey}?exp=${exp}&sig=${sig}`;
}

export function verifyStored(
  blobKey: string,
  hash: string,
  bytes: number,
  sig: string,
): Promise<boolean> {
  return verify(
    env.IMAGE_URL_SECRET,
    messages.stored(blobKey, hash, bytes),
    sig,
  );
}

export function withGrant(url: string, grant: ImageGrant): string {
  return url.startsWith(`${env.CONVEX_SITE_URL}${IMAGE_ROUTE}`) ||
    url.startsWith(`${env.SITE_URL}${BLOB_IMAGE_ROUTE}`)
    ? `${url}?exp=${grant.exp}&sig=${grant.sig}`
    : url;
}

export function grantExpiry(now: number): number {
  return (Math.floor(now / HOUR_MS) + 2) * HOUR_MS;
}

export async function createGrant(
  project: { _id: Id<"projects">; accountId: Id<"accounts"> },
  now: number,
): Promise<ImageGrant> {
  const exp = grantExpiry(now);
  return {
    exp,
    sig: await sign(
      env.IMAGE_URL_SECRET,
      messages.grant(project._id, project.accountId, exp),
    ),
  };
}

export async function verifyGrant(
  projectId: string,
  accountId: string,
  exp: number,
  sig: string,
  now: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(exp) || exp <= now) {
    return false;
  }
  return verify(
    env.IMAGE_URL_SECRET,
    messages.grant(projectId, accountId, exp),
    sig,
  );
}
