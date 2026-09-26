import type { Id } from "../_generated/dataModel";
import { env } from "../_generated/server";
import { messages, sign, verify } from "./signing";

export const IMAGE_ROUTE = "/images/";

const HOUR_MS = 60 * 60 * 1000;

export type ImageGrant = { exp: number; sig: string };

export function privateImageUrl(
  projectId: Id<"projects">,
  imageId: Id<"images">,
): string {
  return `${env.CONVEX_SITE_URL}${IMAGE_ROUTE}${projectId}/${imageId}`;
}

export async function r2ImageUrl(
  project: { _id: Id<"projects">; private: boolean },
  image: { accountId: Id<"accounts">; hash: string; r2Key: string },
  imagesUrl: string,
): Promise<string> {
  const token = `${image.accountId}.${image.hash}`;
  return project.private
    ? `${imagesUrl}${IMAGE_ROUTE}${project._id}/${token}.${await sign(
        env.IMAGE_URL_SECRET,
        messages.privateImage(project._id, image.r2Key),
      )}`
    : `${imagesUrl}/files/${token}.${await sign(
        env.IMAGE_URL_SECRET,
        messages.publicImage(image.r2Key),
      )}`;
}

export function withGrant(url: string, grant: ImageGrant): string {
  const routes = [env.CONVEX_SITE_URL, env.IMAGES_URL].flatMap((base) =>
    base === undefined ? [] : [`${base}${IMAGE_ROUTE}`],
  );
  return routes.some((route) => url.startsWith(route))
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
  return {
    exp,
    sig: await sign(env.IMAGE_URL_SECRET, messages.grant(projectId, exp)),
  };
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
  return verify(env.IMAGE_URL_SECRET, messages.grant(projectId, exp), sig);
}
