async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`encryption.${secret}`),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(secret: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret),
    new TextEncoder().encode(plaintext),
  );
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
}

export async function decrypt(
  secret: string,
  encrypted: string,
): Promise<string | null> {
  const [iv, ciphertext] = encrypted.split(".");
  if (iv === undefined || ciphertext === undefined) {
    return null;
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
      await encryptionKey(secret),
      Buffer.from(ciphertext, "base64url"),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
