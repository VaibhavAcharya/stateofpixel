import { createFileRoute } from "@tanstack/react-router";
import { handleBackendHttp } from "../../../server/backend";

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleBackendHttp(request),
    },
  },
});
