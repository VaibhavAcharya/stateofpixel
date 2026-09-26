import type { Id } from "../_generated/dataModel";
import { env } from "../_generated/server";

export const IMAGE_ROUTE = "/images/";

const HOUR_MS = 60 * 60 * 1000;

export type ImageGrant = { exp: number; sig: string };

export function privateImageUrl(
  projectId: Id<"projects">,
  imageId: Id<"images">,
): string {
  return `${env.CONVEX_SITE_URL}${IMAGE_ROUTE}${projectId}/${imageId}`;
}

export function withGrant(url: string, grant: ImageGrant): string {
  return url.startsWith(`${env.CONVEX_SITE_URL}${IMAGE_ROUTE}`)
    ? `${url}?exp=${grant.exp}&sig=${grant.sig}`
    : url;
}

export function grantExpiry(now: number): number {
  return (Math.floor(now / HOUR_MS) + 2) * HOUR_MS;
}

export async function createGrant(
  projectId: Id<"projects">,
  now: number,
): Promise<ImageGrant> {
  const exp = grantExpiry(now);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    grantMessage(projectId, exp),
  );
  return { exp, sig: toBase64Url(new Uint8Array(signature)) };
}

export async function verifyGrant(
  projectId: string,
  exp: number,
  sig: string,
  now: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(exp) || exp <= now) {
    return false;
  }
  const signature = fromBase64Url(sig);
  if (signature === null) {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    signature,
    grantMessage(projectId, exp),
  );
}

function grantMessage(projectId: string, exp: number) {
  return new TextEncoder().encode(`${projectId}.${exp}`);
}

function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.IMAGE_URL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return null;
  }
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (char) => char.charCodeAt(0),
  );
}
