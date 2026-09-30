import { getStore } from "@netlify/blobs";

type NetlifyGlobal = { context?: { deploy?: { context?: string } } };

export function imageStore() {
  const { Netlify } = globalThis as { Netlify?: NetlifyGlobal };
  return getStore({
    name:
      Netlify?.context?.deploy?.context === "production"
        ? "images"
        : "images-dev",
    consistency: "strong",
  });
}
