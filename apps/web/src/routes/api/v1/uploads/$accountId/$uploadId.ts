import { imageStore, presignImageUrl } from "@stateofpixel/backend/imageStore";
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
        const step = url.searchParams.get("step");
        if (step === "presign") {
          if ((await imageStore().getMetadata(blobKey)) !== null) {
            return errorResponse(
              409,
              "already_uploaded",
              "Image is already uploaded.",
            );
          }
          return Response.json({ url: await presignImageUrl(blobKey, "PUT") });
        }
        if (step === "verify") {
          const bytes = await imageStore().get(blobKey, {
            type: "arrayBuffer",
          });
          if (bytes === null) {
            return errorResponse(404, "not_uploaded", "Image is not uploaded.");
          }
          const rejected = await checkImage(bytes, hash);
          if (rejected !== null) {
            await imageStore().delete(blobKey);
            return rejected;
          }
          return receipt(params.uploadId, blobKey, hash, bytes.byteLength);
        }
        const bytes = await request.arrayBuffer();
        const rejected = await checkImage(bytes, hash);
        if (rejected !== null) {
          return rejected;
        }
        await imageStore().set(blobKey, bytes);
        return receipt(params.uploadId, blobKey, hash, bytes.byteLength);
      },
    },
  },
});

async function checkImage(
  bytes: ArrayBuffer,
  hash: string,
): Promise<Response | null> {
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
  return null;
}

async function receipt(
  uploadId: string,
  blobKey: string,
  hash: string,
  bytes: number,
): Promise<Response> {
  const stored = await sign(
    imageSecret(),
    messages.stored(blobKey, hash, bytes),
  );
  return Response.json({ storageId: `blob.${uploadId}.${bytes}.${stored}` });
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
