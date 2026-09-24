import { expect, it } from "vitest";
import { ApiError, createApiClient } from "./api";

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
