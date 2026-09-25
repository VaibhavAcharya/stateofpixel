import type { api } from "@stateofpixel/backend/api";
import type { FunctionReturnType } from "convex/server";

export type Build = NonNullable<FunctionReturnType<typeof api.builds.get>>;
export type SnapshotRow = FunctionReturnType<
  typeof api.snapshots.list
>["page"][number];
export type Snapshot = NonNullable<
  FunctionReturnType<typeof api.snapshots.get>
>;
