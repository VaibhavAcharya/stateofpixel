import type { Id } from "@stateofpixel/backend/dataModel";
import type { QueryClient } from "@tanstack/react-query";
import {
  api,
  type FunctionArgs,
  type FunctionReference,
  queryOptions,
} from "./backend";

function prefetch<Query extends FunctionReference<"query">>(
  queryClient: QueryClient,
  query: Query,
  args: FunctionArgs<Query>,
) {
  if (typeof window === "undefined") {
    return;
  }
  void queryClient.prefetchQuery(queryOptions(query, args));
}

export function prefetchAccount(queryClient: QueryClient, owner: string) {
  prefetch(queryClient, api.accounts.home, { login: owner });
}

export function prefetchBuild(
  queryClient: QueryClient,
  {
    owner,
    repo,
    number,
    snapshotId,
  }: { owner: string; repo: string; number?: string; snapshotId?: string },
) {
  prefetch(queryClient, api.projects.access, { owner, name: repo });
  const buildNumber = Number(number);
  if (!Number.isInteger(buildNumber)) {
    return;
  }
  const build = { owner, name: repo, number: buildNumber };
  prefetch(queryClient, api.builds.get, build);
  if (snapshotId !== undefined) {
    prefetch(queryClient, api.snapshots.get, {
      ...build,
      snapshotId: snapshotId as Id<"snapshots">,
    });
  }
}
