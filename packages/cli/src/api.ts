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
  fetch?: typeof fetch;
  retries?: number;
  retryDelayMs?: number;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({
  baseUrl,
  token,
  fetch = globalThis.fetch,
  retries = 3,
  retryDelayMs = 1000,
}: ApiClientOptions) {
  async function withRetries<Result>(
    fn: () => Promise<Result>,
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

  function request<Result>(
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
      const response = await fetch(url);
      if (!response.ok) {
        throw await toApiError(response);
      }
      return Buffer.from(await response.arrayBuffer());
    });
  }

  return { request, upload, download };
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
    error instanceof TypeError
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
