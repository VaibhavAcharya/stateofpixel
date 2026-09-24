const TOKEN_PREFIX = "sop_";
const TOKEN_LENGTH = 43;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function isProjectToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

export function generateProjectToken(): string {
  let token = TOKEN_PREFIX;
  while (token.length < TOKEN_PREFIX.length + TOKEN_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(64))) {
      if (byte < 248 && token.length < TOKEN_PREFIX.length + TOKEN_LENGTH) {
        token += BASE62[byte % 62];
      }
    }
  }
  return token;
}

export async function hashProjectToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
