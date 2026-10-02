import { conclude } from "@stateofpixel/backend/conclude";
import type { Id } from "@stateofpixel/backend/dataModel";
import { useNavigate, useParams } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import {
  api,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "../../lib/backend";
import type { DiffStatus, ReviewState } from "../ui";
import type { Build, Snapshot, SnapshotRow } from "./types";

export type ReviewAction = "approve" | "reject" | "undo";

export type SnapshotList = {
  results: SnapshotRow[];
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
};

export type SnapshotArgs = {
  owner: string;
  name: string;
  number: number;
  snapshotId: Id<"snapshots">;
};

export type ReviewArgs = {
  buildId: Id<"builds">;
  snapshotIds: Id<"snapshots">[] | "all";
  action: ReviewAction;
  comment?: string;
};

export type BuildLinkParams = { owner: string; repo: string; number: string };

export type Selection = {
  snapshotId: string | undefined;
  select: (snapshotId: string, options?: { replace?: boolean }) => void;
};

export type BuildData = {
  useSnapshotGroups: (
    buildId: Id<"builds">,
    counts: Build["counts"],
    unchangedOpen: boolean,
  ) => Record<DiffStatus, SnapshotList>;
  useSnapshot: (args: SnapshotArgs) => Snapshot | null | undefined;
  useApplyReview: () => (args: ReviewArgs) => Promise<unknown>;
  useSelection: (params: BuildLinkParams) => Selection;
};

export const NEXT_STATE: Record<ReviewAction, Exclude<ReviewState, "none">> = {
  approve: "approved",
  reject: "rejected",
  undo: "pending",
};

function useSnapshotGroups(
  buildId: Id<"builds">,
  counts: Build["counts"],
  unchangedOpen: boolean,
): Record<DiffStatus, SnapshotList> {
  const options = { initialNumItems: 200 };
  const args = (diffStatus: DiffStatus, enabled: boolean) =>
    enabled ? { buildId, diffStatus } : ("skip" as const);
  return {
    changed: usePaginatedQuery(
      api.snapshots.list,
      args("changed", counts.changed > 0),
      options,
    ),
    added: usePaginatedQuery(
      api.snapshots.list,
      args("added", counts.added > 0),
      options,
    ),
    removed: usePaginatedQuery(
      api.snapshots.list,
      args("removed", counts.removed > 0),
      options,
    ),
    failed: usePaginatedQuery(
      api.snapshots.list,
      args("failed", counts.failed > 0),
      options,
    ),
    unchanged: usePaginatedQuery(
      api.snapshots.list,
      args("unchanged", unchangedOpen && counts.unchanged > 0),
      options,
    ),
  };
}

function useSnapshot(args: SnapshotArgs) {
  return useQuery(api.snapshots.get, args);
}

function useApplyReview() {
  return useMutation(api.reviews.apply).withOptimisticUpdate((store, args) => {
    const next = NEXT_STATE[args.action];
    const ids =
      args.snapshotIds === "all" ? null : new Set<string>(args.snapshotIds);
    const previous = new Map<string, Exclude<ReviewState, "none">>();
    const review = <Row extends { id: string; reviewState: ReviewState }>(
      row: Row,
    ): Row => {
      const current = row.reviewState;
      if (
        current === "none" ||
        current === next ||
        (ids === null ? current !== "pending" : !ids.has(row.id))
      ) {
        return row;
      }
      previous.set(row.id, current);
      return { ...row, reviewState: next };
    };

    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.list,
    )) {
      if (value !== undefined && queryArgs.buildId === args.buildId) {
        store.setQuery(api.snapshots.list, queryArgs, {
          ...value,
          page: value.page.map(review),
        });
      }
    }
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.snapshots.get,
    )) {
      if (value?.buildId === args.buildId) {
        store.setQuery(api.snapshots.get, queryArgs, review(value));
      }
    }

    const reviewCounts = (counts: Build["counts"]) => {
      const result = { ...counts };
      if (ids === null && args.action === "undo") {
        return result;
      }
      if (ids === null) {
        result[next] += result.pending;
        result.pending = 0;
      } else {
        for (const state of previous.values()) {
          result[state]--;
          result[next]++;
        }
      }
      return result;
    };
    const updated = new Map<string, number>();
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.builds.get,
    )) {
      if (value?.buildId === args.buildId) {
        const counts = reviewCounts(value.counts);
        store.setQuery(api.builds.get, queryArgs, {
          ...value,
          counts,
          conclusion: conclude(counts),
          buildAction:
            ids !== null
              ? value.buildAction
              : args.action === "undo"
                ? null
                : args.action,
        });
        updated.set(`${queryArgs.owner}/${queryArgs.name}`, value.number);
      }
    }
    for (const { args: queryArgs, value } of store.getAllQueries(
      api.builds.list,
    )) {
      const number = updated.get(`${queryArgs.owner}/${queryArgs.name}`);
      if (value !== undefined && number !== undefined) {
        store.setQuery(api.builds.list, queryArgs, {
          ...value,
          page: value.page.map((row) => {
            if (row.number !== number) {
              return row;
            }
            const counts = reviewCounts(row.counts);
            return { ...row, counts, conclusion: conclude(counts) };
          }),
        });
      }
    }
  });
}

function useSelection(params: BuildLinkParams): Selection {
  const { snapshotId } = useParams({ strict: false });
  const navigate = useNavigate();
  return {
    snapshotId,
    select: (id, options) =>
      void navigate({
        to: "/$owner/$repo/builds/$number/snapshots/$snapshotId",
        params: { ...params, snapshotId: id },
        replace: options?.replace,
      }),
  };
}

export const BUILD_DATA: BuildData = {
  useSnapshotGroups,
  useSnapshot,
  useApplyReview,
  useSelection,
};

export const BuildDataContext = createContext<BuildData>(BUILD_DATA);

export function useBuildData(): BuildData {
  return useContext(BuildDataContext);
}
