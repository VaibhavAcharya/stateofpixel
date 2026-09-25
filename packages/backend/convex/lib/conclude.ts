import type { Infer } from "convex/values";
import type { buildConclusion, buildCounts } from "../schema";

export function conclude(
  counts: Infer<typeof buildCounts>,
): Infer<typeof buildConclusion> {
  if (counts.rejected > 0) {
    return "rejected";
  }
  if (counts.changed + counts.added + counts.failed === 0) {
    return "no_changes";
  }
  if (counts.pending === 0 && counts.failed === 0) {
    return "approved";
  }
  return "changes";
}
