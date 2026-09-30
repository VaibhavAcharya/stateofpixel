import { one } from "../db/index.ts";
import { encrypt } from "../lib/secrets.ts";
import { accounts, connections, projects, users } from "../schema.ts";
import type { MutationCtx } from "../server.ts";

export const TEST_CONNECTION_SECRET = "test-connection-secret";

export async function insertUser(
  ctx: MutationCtx,
  {
    githubUserId,
    login,
    githubToken = `ghu_${login}`,
    ...fields
  }: {
    githubUserId: number;
    login: string;
    githubToken?: string;
  } & Partial<typeof users.$inferInsert>,
): Promise<string> {
  const user = one(
    await ctx.db
      .insert(users)
      .values({
        identityId: `identity-${githubUserId}`,
        lastSeenAt: 0,
        ...fields,
      })
      .returning({ _id: users._id }),
  );
  await ctx.db.insert(connections).values({
    userId: user._id,
    provider: "github",
    providerUserId: githubUserId,
    login,
    accessToken: await encrypt(TEST_CONNECTION_SECRET, githubToken),
  });
  return user._id;
}

export async function insertAccount(
  ctx: MutationCtx,
  fields: Partial<typeof accounts.$inferInsert> = {},
): Promise<string> {
  const account = one(
    await ctx.db
      .insert(accounts)
      .values({
        providerAccountId: 1,
        login: "acme",
        type: "org",
        installationId: 10,
        plan: "free",
        storageLimitBytes: 10 * 1024 ** 3,
        storageBytes: 0,
        ...fields,
      })
      .returning({ _id: accounts._id }),
  );
  return account._id;
}

export async function insertProject(
  ctx: MutationCtx,
  accountId: string,
  fields: Partial<typeof projects.$inferInsert> = {},
): Promise<string> {
  const project = one(
    await ctx.db
      .insert(projects)
      .values({
        accountId,
        providerRepoId: 100,
        owner: "acme",
        name: "web-app",
        private: true,
        defaultBranch: "main",
        autoApproveBranches: ["main"],
        diffThreshold: 0.1,
        diffIncludeAA: false,
        prRetentionDays: 30,
        nextBuildNumber: 1,
        ...fields,
      })
      .returning({ _id: projects._id }),
  );
  return project._id;
}
