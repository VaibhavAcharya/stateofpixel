import { getStore } from "@netlify/blobs";
import { verify } from "@stateofpixel/backend/signing";

type NetlifyGlobal = { context?: { deploy?: { context?: string } } };

export function imageStore() {
  const { Netlify } = globalThis as { Netlify?: NetlifyGlobal };
  return getStore({
    name:
      Netlify?.context?.deploy?.context === "production"
        ? "images"
        : "images-dev",
    consistency: "strong",
  });
}

export function imageSecret(): string {
  const secret = process.env.IMAGE_URL_SECRET;
  if (!secret) {
    throw new Error("Missing IMAGE_URL_SECRET");
  }
  return secret;
}

export async function verifyUntil(
  message: string,
  exp: number,
  sig: string,
): Promise<boolean> {
  if (!Number.isSafeInteger(exp) || exp <= Date.now()) {
    return false;
  }
  return verify(imageSecret(), message, sig);
}

export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
