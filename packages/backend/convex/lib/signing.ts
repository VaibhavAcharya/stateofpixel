export const messages = {
  grant: (projectId: string, accountId: string, exp: number) =>
    `${projectId}.${accountId}.${exp}`,
  upload: (key: string, hash: string, exp: number) =>
    `upload.${key}.${hash}.${exp}`,
  stored: (key: string, hash: string, bytes: number) =>
    `stored.${key}.${hash}.${bytes}`,
  delete: (key: string, exp: number) => `delete.${key}.${exp}`,
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
