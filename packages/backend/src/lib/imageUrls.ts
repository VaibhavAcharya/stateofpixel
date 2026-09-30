import type { Id } from "../dataModel.ts";
import { env } from "../env.ts";
import { messages, PUBLIC_IMAGE_SCOPE, sign, verify } from "./signing.ts";

const BLOB_IMAGE_ROUTE = "/api/images/";
const UPLOAD_ROUTE = "/api/v1/uploads/";

const HOUR_MS = 60 * 60 * 1000;

export type ImageGrant = { exp: number; sig: string };

export async function blobImageUrl(
  project: { _id: Id<"projects">; private: boolean },
  blobKey: string,
): Promise<string> {
  const file = blobKey.replace("/", ".");
  if (!project.private) {
    const token = await imageToken(PUBLIC_IMAGE_SCOPE, blobKey);
    return `${env.SITE_URL}${BLOB_IMAGE_ROUTE}${file}?t=${token}`;
  }
  const token = await imageToken(project._id, blobKey);
  return `${env.SITE_URL}${BLOB_IMAGE_ROUTE}${project._id}/${file}?t=${token}`;
}

function imageToken(scope: string, key: string): Promise<string> {
  return sign(env.IMAGE_URL_SECRET, messages.image(scope, key));
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
  return url.startsWith(`${env.SITE_URL}${BLOB_IMAGE_ROUTE}`)
    ? `${url}${url.includes("?") ? "&" : "?"}exp=${grant.exp}&sig=${grant.sig}`
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
