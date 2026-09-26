import {
  messages,
  R2_RECEIPT_PREFIX,
  r2Key,
  sign,
} from "@stateofpixel/backend/signing";
import { beforeEach, expect, it, vi } from "vitest";
import { type Env, handle } from "./index";

const SECRET = "test-image-secret";
const ACCOUNT = "account1";
const PROJECT = "project1";
const ctx = { waitUntil: () => undefined };

let objects: Map<string, { body: ArrayBuffer; uploaded: Date }>;
let env: Env;

beforeEach(() => {
  objects = new Map();
  const bucket = {
    get: async (key: string) => {
      const object = objects.get(key);
      return object === undefined
        ? null
        : { body: object.body, httpEtag: '"etag"' };
    },
    head: async (key: string) => objects.get(key) ?? null,
    put: async (key: string, body: ArrayBuffer) => {
      objects.set(key, { body, uploaded: new Date() });
    },
    delete: async (key: string) => {
      objects.delete(key);
    },
  };
  env = { IMAGES: bucket as unknown as R2Bucket, IMAGE_URL_SECRET: SECRET };
  vi.stubGlobal("caches", {
    default: {
      match: async () => undefined,
      put: async () => undefined,
      delete: async () => false,
    },
  });
});

async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadUrl(hash: string, exp = Date.now() + 60_000) {
  const sig = await sign(SECRET, messages.upload(ACCOUNT, hash, exp));
  return `https://images.test/upload/${ACCOUNT}/${hash}?exp=${exp}&sig=${sig}`;
}

function post(url: string, body: string) {
  return handle(new Request(url, { method: "POST", body }), env, ctx);
}

it("stores an upload that matches its hash and returns a signed receipt", async () => {
  const hash = await sha256("header-v1");
  const response = await post(await uploadUrl(hash), "header-v1");
  expect(response.status).toBe(200);
  const key = r2Key(ACCOUNT, hash);
  expect(await response.json()).toEqual({
    storageId: `${R2_RECEIPT_PREFIX}9.${await sign(SECRET, messages.receipt(key, 9))}`,
  });
  expect(objects.has(key)).toBe(true);
});

it("rejects uploads with a wrong body, a bad signature or an expired link", async () => {
  const hash = await sha256("header-v1");
  expect((await post(await uploadUrl(hash), "other")).status).toBe(400);
  expect(
    (
      await post(
        (await uploadUrl(hash)).replace(/sig=.*/, "sig=x"),
        "header-v1",
      )
    ).status,
  ).toBe(403);
  expect(
    (await post(await uploadUrl(hash, Date.now() - 1), "header-v1")).status,
  ).toBe(403);
  expect(objects.size).toBe(0);
});

it("serves a private image only with a valid grant and image signature", async () => {
  const hash = await sha256("header-v1");
  await post(await uploadUrl(hash), "header-v1");
  const key = r2Key(ACCOUNT, hash);
  const exp = Date.now() + 60_000;
  const grant = await sign(SECRET, messages.grant(PROJECT, exp));
  const imageSig = await sign(SECRET, messages.privateImage(PROJECT, key));
  const url = `https://images.test/images/${PROJECT}/${ACCOUNT}.${hash}.${imageSig}`;

  const response = await handle(
    new Request(`${url}?exp=${exp}&sig=${grant}`),
    env,
    ctx,
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("header-v1");
  expect(response.headers.get("Cache-Control")).toMatch(
    /^private, max-age=\d+, immutable$/,
  );

  const otherProject = url.replace(`/${PROJECT}/`, "/project2/");
  const otherGrant = await sign(SECRET, messages.grant("project2", exp));
  expect(
    (
      await handle(
        new Request(`${otherProject}?exp=${exp}&sig=${otherGrant}`),
        env,
        ctx,
      )
    ).status,
  ).toBe(403);
  expect((await handle(new Request(url), env, ctx)).status).toBe(403);
});

it("serves a public image with its signature", async () => {
  const hash = await sha256("header-v1");
  await post(await uploadUrl(hash), "header-v1");
  const sig = await sign(SECRET, messages.publicImage(r2Key(ACCOUNT, hash)));
  const response = await handle(
    new Request(`https://images.test/files/${ACCOUNT}.${hash}.${sig}`),
    env,
    ctx,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe(
    "public, max-age=31536000, immutable",
  );
});

it("deletes an object only when it was uploaded before the signed time", async () => {
  const hash = await sha256("header-v1");
  await post(await uploadUrl(hash), "header-v1");
  const key = r2Key(ACCOUNT, hash);
  const remove = async (before: number) =>
    handle(
      new Request(
        `https://images.test/objects/${key}?before=${before}&sig=${await sign(
          SECRET,
          messages.delete(key, before),
        )}`,
        { method: "DELETE" },
      ),
      env,
      ctx,
    );

  expect((await remove(0)).status).toBe(204);
  expect(objects.has(key)).toBe(true);
  expect((await remove(Date.now() + 1)).status).toBe(204);
  expect(objects.has(key)).toBe(false);
});
