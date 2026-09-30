import { and, eq } from "drizzle-orm";
import { first } from "./db/index.ts";
import { connections, users } from "./schema.ts";
import { query } from "./server.ts";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    if (ctx.userId === null) {
      return null;
    }
    const user = first(
      await ctx.db
        .select({
          name: users.name,
          image: users.image,
          login: connections.login,
        })
        .from(users)
        .leftJoin(
          connections,
          and(
            eq(connections.userId, users._id),
            eq(connections.provider, "github"),
          ),
        )
        .where(eq(users._id, ctx.userId)),
    );
    if (user === null) {
      return null;
    }
    return { login: user.login, name: user.name, image: user.image };
  },
});
