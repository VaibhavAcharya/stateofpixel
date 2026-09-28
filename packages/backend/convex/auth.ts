import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      profile(githubProfile, tokens) {
        if (!tokens.access_token) {
          throw new Error("GitHub did not return an access token");
        }
        return {
          id: String(githubProfile.id),
          name: githubProfile.name ?? undefined,
          email: githubProfile.email ?? undefined,
          image: githubProfile.avatar_url,
          githubUserId: githubProfile.id,
          login: githubProfile.login,
          githubToken: tokens.access_token,
          lastSeenAt: Date.now(),
        };
      },
    }),
  ],
});
