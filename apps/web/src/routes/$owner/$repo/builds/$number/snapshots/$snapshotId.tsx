import { createFileRoute } from "@tanstack/react-router";
import { prefetchBuild } from "../../../../../../lib/prefetch";

export const Route = createFileRoute(
  "/$owner/$repo/builds/$number/snapshots/$snapshotId",
)({
  loader: ({ context, params }) => {
    void prefetchBuild(context.convex, params);
  },
  component: () => null,
});
