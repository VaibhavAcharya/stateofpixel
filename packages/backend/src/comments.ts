import { eq } from "drizzle-orm";
import { z } from "zod";
import { first } from "./db/index.ts";
import { MAX_COMMENT_LENGTH } from "./lib/limits.ts";
import { requirePermission } from "./lib/permissions.ts";
import { builds, comments, snapshots } from "./schema.ts";
import { AppError, mutation } from "./server.ts";

export const add = mutation({
  args: { snapshotId: z.string(), body: z.string() },
  handler: async (ctx, { snapshotId, body }) => {
    const snapshot = first(
      await ctx.db
        .select()
        .from(snapshots)
        .where(eq(snapshots._id, snapshotId)),
    );
    const build =
      snapshot === null
        ? null
        : first(
            await ctx.db
              .select()
              .from(builds)
              .where(eq(builds._id, snapshot.buildId)),
          );
    if (snapshot === null || build === null) {
      throw new AppError({ code: "not_found" });
    }
    const { userId } = await requirePermission(ctx, build.projectId, "write");
    if (userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const trimmed = body.trim();
    if (trimmed === "" || trimmed.length > MAX_COMMENT_LENGTH) {
      throw new AppError({ code: "invalid_comment" });
    }
    await ctx.db.insert(comments).values({
      snapshotId,
      buildId: build._id,
      userId,
      body: trimmed,
    });
    return null;
  },
});
