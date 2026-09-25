import { createFileRoute } from "@tanstack/react-router";
import { prefetchBuild } from "../../../../../../lib/prefetch";

export const Route = createFileRoute(
  "/$owner/$repo/builds/$number/snapshots/$snapshotId",
)({
  loader: ({ context, params }) => prefetchBuild(context.convex, params),
  component: () => null,
});
