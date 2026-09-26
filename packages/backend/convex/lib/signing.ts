export const R2_RECEIPT_PREFIX = "r2:";

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]+$/;

export function r2Key(accountId: string, hash: string): string {
  return `a/${accountId}/img/${hash.slice(0, 2)}/${hash}.png`;
}

export function parseImageToken(
  token: string,
): { accountId: string; hash: string; sig: string } | null {
  const [accountId, hash, sig, ...rest] = token.split(".");
  if (
    accountId === undefined ||
    hash === undefined ||
    sig === undefined ||
    rest.length > 0 ||
    !ID.test(accountId) ||
    !HASH.test(hash)
  ) {
    return null;
  }
  return { accountId, hash, sig };
}

export const messages = {
  grant: (projectId: string, exp: number) => `${projectId}.${exp}`,
  upload: (accountId: string, hash: string, exp: number) =>
    `upload.${accountId}.${hash}.${exp}`,
  receipt: (key: string, bytes: number) => `stored.${key}.${bytes}`,
  privateImage: (projectId: string, key: string) => `image.${projectId}.${key}`,
  publicImage: (key: string) => `public.${key}`,
  delete: (key: string, before: number) => `delete.${key}.${before}`,
};

export async function sign(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(message),
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function verify(
  secret: string,
  message: string,
  sig: string,
): Promise<boolean> {
  const signature = fromBase64Url(sig);
  if (signature === null) {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(secret),
    signature,
    new TextEncoder().encode(message),
  );
}

function signingKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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
