import { MAX_IMAGE_BYTES } from "@stateofpixel/backend/limits";
import {
  messages,
  parseImageToken,
  R2_RECEIPT_PREFIX,
  r2Key,
  sign,
  verify,
} from "@stateofpixel/backend/signing";

export type Env = { IMAGES: R2Bucket; IMAGE_URL_SECRET: string };

type Context = { waitUntil(promise: Promise<unknown>): void };

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9]+$/;
const YEAR_S = 365 * 24 * 60 * 60;

export default {
  fetch: (request, env, ctx) => handle(request, env, ctx),
} satisfies ExportedHandler<Env>;

export async function handle(
  request: Request,
  env: Env,
  ctx: Context,
): Promise<Response> {
  const url = new URL(request.url);
  const [route, ...parts] = url.pathname.slice(1).split("/");
  if (request.method === "GET" && route === "images" && parts.length === 2) {
    return servePrivate(env, ctx, url, parts[0] ?? "", parts[1] ?? "");
  }
  if (request.method === "GET" && route === "files" && parts.length === 1) {
    return servePublic(env, ctx, parts[0] ?? "");
  }
  if (request.method === "POST" && route === "upload" && parts.length === 2) {
    return upload(env, request, url, parts[0] ?? "", parts[1] ?? "");
  }
  if (request.method === "DELETE" && route === "objects") {
    return deleteObject(env, url, parts.join("/"));
  }
  return new Response("Not found", { status: 404 });
}

async function servePrivate(
  env: Env,
  ctx: Context,
  url: URL,
  projectId: string,
  token: string,
): Promise<Response> {
  const image = parseImageToken(token);
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (
    image === null ||
    !ID.test(projectId) ||
    !Number.isSafeInteger(exp) ||
    exp <= Date.now()
  ) {
    return forbidden();
  }
  const key = r2Key(image.accountId, image.hash);
  if (
    !(await verify(
      env.IMAGE_URL_SECRET,
      messages.grant(projectId, exp),
      sig,
    )) ||
    !(await verify(
      env.IMAGE_URL_SECRET,
      messages.privateImage(projectId, key),
      image.sig,
    ))
  ) {
    return forbidden();
  }
  const maxAge = Math.floor((exp - Date.now()) / 1000);
  return serveObject(env, ctx, key, `private, max-age=${maxAge}, immutable`);
}

async function servePublic(
  env: Env,
  ctx: Context,
  token: string,
): Promise<Response> {
  const image = parseImageToken(token);
  if (image === null) {
    return forbidden();
  }
  const key = r2Key(image.accountId, image.hash);
  if (
    !(await verify(env.IMAGE_URL_SECRET, messages.publicImage(key), image.sig))
  ) {
    return forbidden();
  }
  return serveObject(env, ctx, key, `public, max-age=${YEAR_S}, immutable`);
}

async function serveObject(
  env: Env,
  ctx: Context,
  key: string,
  cacheControl: string,
): Promise<Response> {
  const cacheKey = cacheRequest(key);
  let response = await caches.default.match(cacheKey);
  if (response === undefined) {
    const object = await env.IMAGES.get(key);
    if (object === null) {
      return new Response("Not found", { status: 404 });
    }
    response = new Response(object.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${YEAR_S}, immutable`,
        ETag: object.httpEtag,
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, { headers });
}

async function upload(
  env: Env,
  request: Request,
  url: URL,
  accountId: string,
  hash: string,
): Promise<Response> {
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (
    !ID.test(accountId) ||
    !HASH.test(hash) ||
    !Number.isSafeInteger(exp) ||
    exp <= Date.now() ||
    !(await verify(
      env.IMAGE_URL_SECRET,
      messages.upload(accountId, hash, exp),
      sig,
    ))
  ) {
    return forbidden();
  }
  if (Number(request.headers.get("Content-Length")) > MAX_IMAGE_BYTES) {
    return tooLarge();
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return tooLarge();
  }
  if (toHex(await crypto.subtle.digest("SHA-256", bytes)) !== hash) {
    return new Response("Body does not match the hash", { status: 400 });
  }
  const key = r2Key(accountId, hash);
  await env.IMAGES.put(key, bytes, {
    httpMetadata: { contentType: "image/png" },
    sha256: hash,
  });
  const receipt = await sign(
    env.IMAGE_URL_SECRET,
    messages.receipt(key, bytes.byteLength),
  );
  return Response.json({
    storageId: `${R2_RECEIPT_PREFIX}${bytes.byteLength}.${receipt}`,
  });
}

async function deleteObject(
  env: Env,
  url: URL,
  key: string,
): Promise<Response> {
  const before = Number(url.searchParams.get("before"));
  const sig = url.searchParams.get("sig") ?? "";
  if (
    !Number.isSafeInteger(before) ||
    !(await verify(env.IMAGE_URL_SECRET, messages.delete(key, before), sig))
  ) {
    return forbidden();
  }
  const object = await env.IMAGES.head(key);
  if (object !== null && object.uploaded.getTime() < before) {
    await env.IMAGES.delete(key);
    await caches.default.delete(cacheRequest(key));
  }
  return new Response(null, { status: 204 });
}

function cacheRequest(key: string): Request {
  return new Request(`https://images.stateofpixel.cache/${key}`);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function forbidden(): Response {
  return new Response("Forbidden", { status: 403 });
}

function tooLarge(): Response {
  return new Response("Image is too large", { status: 413 });
}
