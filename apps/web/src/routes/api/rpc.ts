import { verifyRequestOrigin } from "@netlify/identity";
import { AppError, lookup, run } from "@stateofpixel/backend/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUserId, withBackend } from "../../server/backend";

function errorResponse(status: number, code: string) {
  return Response.json({ error: { code } }, { status });
}

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          verifyRequestOrigin(request);
        } catch {
          return errorResponse(403, "forbidden");
        }
        withBackend(request.url);
        let body: { name?: unknown; args?: unknown };
        try {
          body = await request.json();
        } catch {
          return errorResponse(400, "invalid_args");
        }
        const ref = typeof body.name === "string" ? lookup(body.name) : null;
        if (ref === null || ref.visibility !== "public") {
          return errorResponse(404, "not_found");
        }
        try {
          const value = await run(ref, body.args, await currentUserId(request));
          return Response.json({ value: value ?? null });
        } catch (error) {
          if (error instanceof AppError) {
            return Response.json({ error: error.data }, { status: 400 });
          }
          if (error instanceof z.ZodError) {
            return errorResponse(400, "invalid_args");
          }
          console.error(`${String(body.name)} failed`, error);
          return errorResponse(500, "internal_error");
        }
      },
    },
  },
});
