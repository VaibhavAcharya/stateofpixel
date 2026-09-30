import type { z } from "zod";
import type { buildConclusion, buildCounts } from "../schema.ts";

export function conclude(
  counts: z.infer<typeof buildCounts>,
): z.infer<typeof buildConclusion> {
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
