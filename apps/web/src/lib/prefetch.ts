import { api } from "@stateofpixel/backend/api";
import type { Id } from "@stateofpixel/backend/dataModel";
import type { ConvexReactClient } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

const HOLD_MS = 60_000;

function prefetch<Query extends FunctionReference<"query">>(
  convex: ConvexReactClient,
  query: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query> | undefined> {
  if (typeof window === "undefined") {
    return Promise.resolve(undefined);
  }
  const watch = convex.watchQuery(query, args);
  return new Promise((resolve) => {
    const read = () => {
      try {
        const result = watch.localQueryResult();
        if (result !== undefined) {
          resolve(result);
        }
      } catch {
        resolve(undefined);
      }
    };
    const unsubscribe = watch.onUpdate(read);
    setTimeout(unsubscribe, HOLD_MS);
    read();
  });
}

export function prefetchAccount(convex: ConvexReactClient, owner: string) {
  void prefetch(convex, api.accounts.home, { login: owner });
}

export async function prefetchBuild(
  convex: ConvexReactClient,
  {
    owner,
    repo,
    number,
    snapshotId,
  }: { owner: string; repo: string; number?: string; snapshotId?: string },
) {
  const access = await prefetch(convex, api.projects.access, {
    owner,
    name: repo,
  });
  const buildNumber = Number(number);
  if (!access?.canRead || !Number.isInteger(buildNumber)) {
    return;
  }
  const build = await prefetch(convex, api.builds.get, {
    projectId: access.projectId,
    number: buildNumber,
  });
  if (build && snapshotId !== undefined) {
    void prefetch(convex, api.snapshots.get, {
      buildId: build.buildId,
      snapshotId: snapshotId as Id<"snapshots">,
    });
  }
}
