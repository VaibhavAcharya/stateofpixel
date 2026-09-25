import { createFileRoute } from "@tanstack/react-router";
import { isLab } from "../../../../../../lib/lab";
import { prefetchBuild } from "../../../../../../lib/prefetch";

export const Route = createFileRoute(
  "/$owner/$repo/builds/$number/snapshots/$snapshotId",
)({
  loader: ({ context, params }) =>
    isLab(params.owner) ? undefined : prefetchBuild(context.convex, params),
  component: () => null,
});
