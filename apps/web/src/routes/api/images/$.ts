import { messages } from "@stateofpixel/backend/signing";
import { createFileRoute } from "@tanstack/react-router";
import { imageStore, verifyUntil } from "../../../lib/imageStore";

const FILE = /^([a-z0-9]+)\.([0-9a-f-]{36})$/;
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

export const Route = createFileRoute("/api/images/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const segments = params._splat?.split("/") ?? [];
        const file = FILE.exec(segments.at(-1) ?? "");
        if (file === null || segments.length > 2) {
          return new Response("Not found", { status: 404 });
        }
        const [, accountId, uploadId] = file;
        let cacheControl = PUBLIC_CACHE;
        if (segments.length === 2) {
          const projectId = segments[0] ?? "";
          const exp = Number(url.searchParams.get("exp"));
          const sig = url.searchParams.get("sig") ?? "";
          if (
            !(await verifyUntil(
              messages.grant(projectId, accountId ?? "", exp),
              exp,
              sig,
            ))
          ) {
            return new Response("Forbidden", { status: 403 });
          }
          cacheControl = `private, max-age=${Math.floor((exp - Date.now()) / 1000)}, immutable`;
        }
        const image = await imageStore().get(`${accountId}/${uploadId}`, {
          type: "stream",
        });
        if (image === null) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(image, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": cacheControl,
          },
        });
      },
    },
  },
});
