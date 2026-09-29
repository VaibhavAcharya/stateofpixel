export const DEFAULT_API_URL =
  "https://graceful-dogfish-423.convex.site/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type SnapshotLookup = {
  name: string;
  status: "unchanged" | "changed" | "added";
  baselineUrl?: string;
  uploadUrl?: string;
};

export type CreateBuildResponse = {
  buildId: string;
  buildNumber: number;
  shardIndex: number;
  url: string;
  diff: { threshold: number; includeAA: boolean };
  baseline: { buildNumber: number; commit: string } | null;
  snapshots: SnapshotLookup[];
  warnings: string[];
};

export type BuildCounts = {
  unchanged: number;
  changed: number;
  added: number;
  removed: number;
  failed: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type BuildResponse = {
  buildId: string;
  buildNumber: number;
  url: string;
  status: "pending" | "finalized" | "expired" | "error";
  conclusion: "no_changes" | "changes" | "approved" | "rejected" | null;
  counts: BuildCounts;
  shards: { done: number; total: number | null };
};

type ApiClientOptions = {
  baseUrl: string;
  token: string;
  refreshToken?: () => Promise<string>;
  fetch?: typeof fetch;
  retries?: number;
  retryDelayMs?: number;
  transferTimeoutMs?: number;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  token: initialToken,
  refreshToken,
  fetch: rawFetch = globalThis.fetch,
  retries = 3,
  retryDelayMs = 1000,
  transferTimeoutMs = 30_000,
}: ApiClientOptions) {
  let token = initialToken;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const label = `${init?.method ?? "GET"} ${url.host}${url.pathname}`;
    const start = Date.now();
    console.error(`stateofpixel debug: -> ${label}`);
    try {
      const response = await rawFetch(input, init);
      console.error(
        `stateofpixel debug: <- ${label} ${response.status} ${Date.now() - start}ms`,
      );
      return response;
    } catch (error) {
      console.error(
        `stateofpixel debug: !! ${label} ${error instanceof Error ? error.message : error} ${Date.now() - start}ms`,
      );
      throw error;
    }
  };
  function withRetries<Result>(fn: () => Promise<Result>): Promise<Result> {
    return retryServerErrors(fn, retries, retryDelayMs);
  }

  async function request<Result>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Result> {
    try {
      return await send<Result>(method, path, body);
    } catch (error) {
      if (
        refreshToken === undefined ||
        !(error instanceof ApiError && error.status === 401)
      ) {
        throw error;
      }
      token = await refreshToken();
      return send<Result>(method, path, body);
    }
  }

  function send<Result>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<Result> {
    return withRetries(async () => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      return (await response.json()) as Result;
    });
  }

  function upload(uploadUrl: string, bytes: Buffer): Promise<string> {
    return withRetries(async () => {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(transferTimeoutMs),
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const { storageId } = (await response.json()) as { storageId: string };
      return storageId;
    });
  }

  function download(url: string): Promise<Buffer> {
    return withRetries(async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(transferTimeoutMs),
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const start = Date.now();
      const bytes = Buffer.from(await response.arrayBuffer());
      console.error(
        `stateofpixel debug: body ${new URL(url).pathname} ${bytes.length} bytes ${Date.now() - start}ms`,
      );
      return bytes;
    });
  }

  return { request, upload, download };
}

export async function retryServerErrors<Result>(
  fn: () => Promise<Result>,
  retries = 3,
  retryDelayMs = 1000,
): Promise<Result> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isServerError(error)) {
        throw error;
      }
      await sleep(retryDelayMs * 2 ** attempt);
    }
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  return new ApiError(
    response.status,
    body?.error?.code ?? "http_error",
    body?.error?.message ?? `HTTP ${response.status}`,
  );
}

export function isServerError(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.status >= 500) ||
    error instanceof TypeError ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

export function isRateLimited(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
