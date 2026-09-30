import type { api, FunctionReturnType } from "../../lib/backend";

export type Build = NonNullable<FunctionReturnType<typeof api.builds.get>>;
export type SnapshotRow = FunctionReturnType<
  typeof api.snapshots.list
>["page"][number];
export type Snapshot = NonNullable<
  FunctionReturnType<typeof api.snapshots.get>
>;
