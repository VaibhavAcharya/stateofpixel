import { z } from "zod";
import { createGrant } from "./lib/imageUrls.ts";
import { requirePermission } from "./lib/permissions.ts";
import { mutation } from "./server.ts";

export const grant = mutation({
  args: { projectId: z.string() },
  handler: async (ctx, { projectId }) => {
    const { project } = await requirePermission(ctx, projectId, "read");
    return createGrant(project, Date.now());
  },
});
