import { imageStore } from "@stateofpixel/backend/imageStore";
import { MAX_IMAGE_BYTES } from "@stateofpixel/backend/limits";
import { messages, sign } from "@stateofpixel/backend/signing";
import { createFileRoute } from "@tanstack/react-router";
import {
  errorResponse,
  imageSecret,
  verifyUntil,
} from "../../../../../lib/imageStore";

export const Route = createFileRoute("/api/v1/uploads/$accountId/$uploadId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const blobKey = `${params.accountId}/${params.uploadId}`;
        const hash = url.searchParams.get("hash") ?? "";
        const exp = Number(url.searchParams.get("exp"));
        const sig = url.searchParams.get("sig") ?? "";
        if (
          !(await verifyUntil(messages.upload(blobKey, hash, exp), exp, sig))
        ) {
          return errorResponse(
            403,
            "forbidden",
            "Upload link is invalid or expired.",
          );
        }
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength > MAX_IMAGE_BYTES) {
          return errorResponse(
            413,
            "image_too_large",
            `Image is over ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
          );
        }
        if ((await sha256(bytes)) !== hash) {
          return errorResponse(
            400,
            "hash_mismatch",
            "Image does not match its hash.",
          );
        }
        await imageStore().set(blobKey, bytes);
        const stored = await sign(
          imageSecret(),
          messages.stored(blobKey, hash, bytes.byteLength),
        );
        return Response.json({
          storageId: `blob.${params.uploadId}.${bytes.byteLength}.${stored}`,
        });
      },
    },
  },
});

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
