import { eq } from "drizzle-orm";
import { z } from "zod";
import { first, one } from "./db/index.ts";
import { users } from "./schema.ts";
import {
  internalMutation,
  internalQuery,
  runMutation,
  runQuery,
} from "./server.ts";

const LAST_SEEN_INTERVAL_MS = 60 * 60 * 1000;

const identity = {
  identityId: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
};

export async function userIdForIdentity(
  args: z.input<z.ZodObject<typeof identity>>,
): Promise<string> {
  const user = await runQuery(findByIdentity, {
    identityId: args.identityId,
  });
  if (user !== null && Date.now() - user.lastSeenAt <= LAST_SEEN_INTERVAL_MS) {
    return user._id;
  }
  return runMutation(userForIdentity, args);
}

export const findByIdentity = internalQuery({
  args: { identityId: z.string() },
  handler: async (ctx, { identityId }) =>
    first(
      await ctx.db
        .select({ _id: users._id, lastSeenAt: users.lastSeenAt })
        .from(users)
        .where(eq(users.identityId, identityId)),
    ),
});

export const userForIdentity = internalMutation({
  args: identity,
  handler: async (ctx, { identityId, email, name, image }) => {
    const now = Date.now();
    const user = first(
      await ctx.db.select().from(users).where(eq(users.identityId, identityId)),
    );
    if (user === null) {
      const created = one(
        await ctx.db
          .insert(users)
          .values({
            identityId,
            email: email ?? null,
            name: name ?? null,
            image: image ?? null,
            lastSeenAt: now,
          })
          .returning({ _id: users._id }),
      );
      return created._id;
    }
    if (now - user.lastSeenAt > LAST_SEEN_INTERVAL_MS) {
      await ctx.db
        .update(users)
        .set({ lastSeenAt: now })
        .where(eq(users._id, user._id));
    }
    return user._id;
  },
});
