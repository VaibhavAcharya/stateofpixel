import { userIdForIdentity } from "@stateofpixel/backend/auth";
import { handleHttp } from "@stateofpixel/backend/http";
import { configureHost } from "@stateofpixel/backend/server";

export async function kickWorker(siteUrl: string) {
  const response = await fetch(
    new URL("/.netlify/functions/jobs-background", siteUrl),
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(`Job worker returned ${response.status}`);
  }
}

export function withBackend(siteUrl: string) {
  configureHost({ kick: () => kickWorker(siteUrl) });
}

type IdentityUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
};

function readCookie(request: Request, name: string): string | null {
  for (const part of request.headers.get("Cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }
  return null;
}

async function identityUser(request: Request): Promise<IdentityUser | null> {
  const jwt = readCookie(request, "nf_jwt");
  if (jwt === null) {
    return null;
  }
  const response = await fetch(
    new URL("/.netlify/identity/user", request.url),
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  return response.ok ? ((await response.json()) as IdentityUser) : null;
}

export async function currentUserId(request: Request): Promise<string | null> {
  const user = await identityUser(request);
  if (user === null) {
    return null;
  }
  return userIdForIdentity({
    identityId: user.id,
    email: user.email,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name,
    image: user.user_metadata?.avatar_url,
  });
}

export async function handleBackendHttp(request: Request) {
  withBackend(request.url);
  return (
    (await handleHttp(request)) ?? new Response("Not found", { status: 404 })
  );
}
