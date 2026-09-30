import { createFileRoute } from "@tanstack/react-router";
import { handleBackendHttp } from "../../../server/backend";

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleBackendHttp(request),
      POST: ({ request }) => handleBackendHttp(request),
    },
  },
});
