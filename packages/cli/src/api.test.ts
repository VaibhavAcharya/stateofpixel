import { expect, it } from "vitest";
import { ApiError, createApiClient, isRateLimited } from "./api";

function client(responses: (() => Response)[]) {
  let calls = 0;
  const api = createApiClient({
    baseUrl: "https://api.test/api/v1",
    token: "sop_token",
    retryDelayMs: 0,
    fetch: async () => {
      const response = responses[Math.min(calls, responses.length - 1)];
      calls++;
      return (response as () => Response)();
    },
  });
  return { api, calls: () => calls };
}

it("retries server errors", async () => {
  const { api, calls } = client([
    () => new Response("oops", { status: 502 }),
    () => Response.json({ ok: true }),
  ]);
  expect(await api.request("GET", "/builds/1")).toEqual({ ok: true });
  expect(calls()).toBe(2);
});

it("does not retry client errors and reads the error body", async () => {
  const { api, calls } = client([
    () =>
      Response.json(
        { error: { code: "invalid_request", message: "Bad body" } },
        { status: 400 },
      ),
  ]);
  const error = await api.request("POST", "/builds", {}).catch((e) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 400,
    code: "invalid_request",
    message: "Bad body",
  });
  expect(calls()).toBe(1);
});

it("gives up after the retries", async () => {
  const { api, calls } = client([() => new Response("down", { status: 503 })]);
  await expect(api.request("GET", "/builds/1")).rejects.toMatchObject({
    status: 503,
  });
  expect(calls()).toBe(4);
});

it("does not retry rate limits", async () => {
  const { api, calls } = client([
    () =>
      Response.json(
        { error: { code: "rate_limited", message: "Too many requests." } },
        { status: 429 },
      ),
  ]);
  const error = await api.request("GET", "/whoami").catch((e) => e);
  expect(isRateLimited(error)).toBe(true);
  expect(calls()).toBe(1);
});

it("retries an upload that gets no response in time", async () => {
  let calls = 0;
  const api = createApiClient({
    baseUrl: "https://api.test/api/v1",
    token: "sop_token",
    retryDelayMs: 0,
    transferTimeoutMs: 10,
    fetch: async (_input, init) => {
      calls++;
      if (calls === 1) {
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          ),
        );
      }
      return Response.json({ storageId: "blob.1" });
    },
  });
  expect(await api.upload("https://site.test/upload", Buffer.from("png"))).toBe(
    "blob.1",
  );
  expect(calls).toBe(2);
});

it("gets a new token and retries once after a 401", async () => {
  const tokens: (string | null)[] = [];
  const api = createApiClient({
    baseUrl: "https://api.test/api/v1",
    token: "expired",
    refreshToken: async () => "fresh",
    retryDelayMs: 0,
    fetch: async (_input, init) => {
      const authorization = new Headers(init?.headers).get("Authorization");
      tokens.push(authorization);
      return authorization === "Bearer fresh"
        ? Response.json({ ok: true })
        : Response.json(
            { error: { code: "unauthorized", message: "Expired." } },
            { status: 401 },
          );
    },
  });
  expect(await api.request("GET", "/builds/1")).toEqual({ ok: true });
  expect(tokens).toEqual(["Bearer expired", "Bearer fresh"]);
});

it("does not retry a 401 without a way to get a new token", async () => {
  const { api, calls } = client([
    () =>
      Response.json(
        { error: { code: "unauthorized", message: "Bad token." } },
        { status: 401 },
      ),
  ]);
  await expect(api.request("GET", "/whoami")).rejects.toMatchObject({
    status: 401,
  });
  expect(calls()).toBe(1);
});
