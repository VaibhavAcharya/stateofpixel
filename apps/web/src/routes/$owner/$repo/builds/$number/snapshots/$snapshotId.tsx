import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/$owner/$repo/builds/$number/snapshots/$snapshotId",
)({
  component: () => null,
});
