import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { first } from "./db/index.ts";
import { env } from "./env.ts";
import {
  exchangeUserToken,
  GithubError,
  type GithubUserTokens,
  getAuthenticatedUser,
} from "./lib/github.ts";
import { decrypt, encrypt } from "./lib/secrets.ts";
import { messages, sign, verify } from "./lib/signing.ts";
import { connections, users } from "./schema.ts";
import {
  type ActionCtx,
  AppError,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./server.ts";

const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function callbackUrl() {
  return `${env.SITE_URL}/api/github/callback`;
}

function safeRedirect(redirectTo: string) {
  return redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    ? redirectTo
    : "/install";
}

export const githubAuthorizeUrl = query({
  args: { redirectTo: z.string() },
  handler: async (ctx, { redirectTo }) => {
    if (ctx.userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const target = safeRedirect(redirectTo);
    const exp = Date.now() + STATE_TTL_MS;
    const sig = await sign(
      env.CONNECTION_SECRET,
      messages.connect(ctx.userId, target, exp),
    );
    const state = `${exp}.${Buffer.from(target).toString("base64url")}.${sig}`;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("state", state);
    return url.toString();
  },
});

export const connectGithub = action({
  args: { code: z.string(), state: z.string() },
  handler: async (ctx, { code, state }): Promise<string> => {
    if (ctx.userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    const [exp, encodedTarget, sig] = state.split(".");
    const redirectTo = Buffer.from(encodedTarget ?? "", "base64url").toString();
    if (
      exp === undefined ||
      sig === undefined ||
      Number(exp) < Date.now() ||
      !(await verify(
        env.CONNECTION_SECRET,
        messages.connect(ctx.userId, redirectTo, Number(exp)),
        sig,
      ))
    ) {
      throw new AppError({ code: "invalid_state" });
    }
    const tokens = await exchangeUserToken({
      code,
      redirectUri: callbackUrl(),
    });
    const githubUser = await getAuthenticatedUser(tokens.accessToken);
    await ctx.runMutation(internal.connections.saveGithub, {
      userId: ctx.userId,
      providerUserId: githubUser.id,
      login: githubUser.login,
      image: githubUser.avatar_url,
      ...(await encryptTokens(tokens)),
    });
    return safeRedirect(redirectTo);
  },
});

async function encryptTokens(tokens: GithubUserTokens) {
  return {
    accessToken: await encrypt(env.CONNECTION_SECRET, tokens.accessToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshToken:
      tokens.refreshToken === null
        ? null
        : await encrypt(env.CONNECTION_SECRET, tokens.refreshToken),
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  };
}

const tokenFields = {
  accessToken: z.string(),
  accessTokenExpiresAt: z.number().nullable(),
  refreshToken: z.string().nullable(),
  refreshTokenExpiresAt: z.number().nullable(),
};

export const saveGithub = internalMutation({
  args: {
    userId: z.string(),
    providerUserId: z.number(),
    login: z.string(),
    image: z.string(),
    ...tokenFields,
  },
  handler: async (ctx, { userId, providerUserId, login, image, ...tokens }) => {
    const existing = first(
      await ctx.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.provider, "github"),
            eq(connections.providerUserId, providerUserId),
          ),
        ),
    );
    let ownerId = userId;
    if (existing !== null && existing.userId !== userId) {
      const owner = first(
        await ctx.db.select().from(users).where(eq(users._id, existing.userId)),
      );
      if (owner !== null && owner.identityId !== null) {
        throw new AppError({ code: "github_account_in_use" });
      }
      const current = first(
        await ctx.db.delete(users).where(eq(users._id, userId)).returning(),
      );
      await ctx.db.delete(connections).where(eq(connections.userId, userId));
      if (owner !== null && current !== null) {
        await ctx.db
          .update(users)
          .set({
            identityId: current.identityId,
            email: owner.email ?? current.email,
            name: owner.name ?? current.name,
          })
          .where(eq(users._id, owner._id));
        ownerId = owner._id;
      }
    }
    await ctx.db
      .insert(connections)
      .values({
        userId: ownerId,
        provider: "github",
        providerUserId,
        login,
        ...tokens,
      })
      .onConflictDoUpdate({
        target: [connections.userId, connections.provider],
        set: { providerUserId, login, ...tokens },
      });
    await ctx.db.update(users).set({ image }).where(eq(users._id, ownerId));
    return null;
  },
});

export const githubConnection = internalQuery({
  args: { userId: z.string() },
  handler: async (ctx, { userId }) => {
    const connection = first(
      await ctx.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userId, userId),
            eq(connections.provider, "github"),
          ),
        ),
    );
    return connection;
  },
});

export const updateGithubTokens = internalMutation({
  args: { connectionId: z.string(), ...tokenFields },
  handler: async (ctx, { connectionId, ...tokens }) => {
    await ctx.db
      .update(connections)
      .set(tokens)
      .where(eq(connections._id, connectionId));
    return null;
  },
});

export async function githubUserToken(
  ctx: ActionCtx,
  userId: string,
): Promise<string | null> {
  const connection = await ctx.runQuery(internal.connections.githubConnection, {
    userId,
  });
  if (connection === null) {
    return null;
  }
  const accessToken = await decrypt(
    env.CONNECTION_SECRET,
    connection.accessToken,
  );
  if (accessToken === null) {
    return null;
  }
  if (
    connection.accessTokenExpiresAt === null ||
    connection.accessTokenExpiresAt > Date.now() + REFRESH_MARGIN_MS
  ) {
    return accessToken;
  }
  const refreshToken =
    connection.refreshToken === null
      ? null
      : await decrypt(env.CONNECTION_SECRET, connection.refreshToken);
  if (refreshToken === null) {
    return null;
  }
  try {
    const tokens = await exchangeUserToken({ refreshToken });
    await ctx.runMutation(internal.connections.updateGithubTokens, {
      connectionId: connection._id,
      ...(await encryptTokens(tokens)),
    });
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof GithubError) {
      return null;
    }
    throw error;
  }
}

export const disconnectGithub = mutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.userId === null) {
      throw new AppError({ code: "not_signed_in" });
    }
    await ctx.db
      .delete(connections)
      .where(
        and(
          eq(connections.userId, ctx.userId),
          eq(connections.provider, "github"),
        ),
      );
    return null;
  },
});
