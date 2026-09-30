import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$owner/settings/general")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$owner",
      params: { owner: params.owner },
      statusCode: 301,
    });
  },
});
