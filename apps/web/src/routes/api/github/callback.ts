import { internal } from "@stateofpixel/backend/api";
import { AppError, runAction } from "@stateofpixel/backend/server";
import { createFileRoute } from "@tanstack/react-router";
import { currentUserId, withBackend } from "../../../server/backend";

function redirect(request: Request, path: string) {
  return Response.redirect(new URL(path, request.url), 302);
}

function connectError(request: Request, code: string) {
  return redirect(
    request,
    `/install?connect_error=${encodeURIComponent(code)}`,
  );
}

export const Route = createFileRoute("/api/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        withBackend(request.url);
        const userId = await currentUserId(request);
        if (userId === null) {
          return redirect(request, "/install");
        }
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (code === null || state === null) {
          return connectError(
            request,
            url.searchParams.get("error") ?? "invalid_request",
          );
        }
        try {
          return redirect(
            request,
            await runAction(
              internal.connections.connectGithub,
              { code, state },
              userId,
            ),
          );
        } catch (error) {
          if (error instanceof AppError) {
            return connectError(request, error.data.code);
          }
          throw error;
        }
      },
    },
  },
});
