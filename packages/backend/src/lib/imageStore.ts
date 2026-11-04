import { getStore } from "@netlify/blobs";

type NetlifyGlobal = { context?: { deploy?: { context?: string } } };

export function imageStoreName() {
  const { Netlify } = globalThis as { Netlify?: NetlifyGlobal };
  return Netlify?.context?.deploy?.context === "production"
    ? "images"
    : "images-dev";
}

export function imageStore() {
  return getStore({ name: imageStoreName(), consistency: "strong" });
}

type BlobsContext = { apiURL?: string; siteID?: string; token?: string };

function blobsContext(): BlobsContext {
  const encoded =
    (globalThis as { netlifyBlobsContext?: string }).netlifyBlobsContext ??
    process.env.NETLIFY_BLOBS_CONTEXT;
  if (!encoded) {
    throw new Error("Netlify Blobs is not configured");
  }
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

export async function presignImageUrl(
  key: string,
  method: "GET" | "PUT",
): Promise<string> {
  const { apiURL = "https://api.netlify.com", siteID, token } = blobsContext();
  const response = await fetch(
    `${apiURL}/api/v1/blobs/${siteID}/site:${imageStoreName()}/${key}`,
    {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json;type=signed-url",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Presigning ${method} ${key} failed: ${response.status}`);
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}
