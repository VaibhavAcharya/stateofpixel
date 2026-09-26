import { importPKCS8, SignJWT } from "jose";
import { env } from "../_generated/server";

const API_URL = "https://api.github.com";

type GithubAccount = {
  id: number;
  login: string;
  type: "User" | "Organization";
};

export type GithubRepository = {
  id: number;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
};

type GithubInstallation = {
  id: number;
  account: GithubAccount;
  suspended_at: string | null;
};

export class GithubError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`GitHub API ${path} returned ${status}`);
  }
}

async function githubRequest<Result>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Result> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "stateofpixel",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new GithubError(response.status, path);
  }
  return (await response.json()) as Result;
}

async function createAppJwt(): Promise<string> {
  const privateKey = await importPKCS8(env.GITHUB_APP_PRIVATE_KEY, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(env.GITHUB_APP_ID)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(privateKey);
}

export async function getInstallation(
  installationId: number,
): Promise<GithubInstallation> {
  return githubRequest(
    await createAppJwt(),
    `/app/installations/${installationId}`,
  );
}

export async function createInstallationToken(
  installationId: number,
): Promise<string> {
  const { token } = await githubRequest<{ token: string }>(
    await createAppJwt(),
    `/app/installations/${installationId}/access_tokens`,
    { method: "POST" },
  );
  return token;
}

export async function listInstallationRepositories(
  installationToken: string,
): Promise<GithubRepository[]> {
  const repositories: GithubRepository[] = [];
  for (let page = 1; ; page++) {
    const result = await githubRequest<{
      total_count: number;
      repositories: GithubRepository[];
    }>(
      installationToken,
      `/installation/repositories?per_page=100&page=${page}`,
    );
    repositories.push(...result.repositories);
    if (
      result.repositories.length === 0 ||
      repositories.length >= result.total_count
    ) {
      return repositories;
    }
  }
}

export async function listUserInstallations(
  userToken: string,
): Promise<GithubInstallation[]> {
  const installations: GithubInstallation[] = [];
  for (let page = 1; ; page++) {
    const result = await githubRequest<{
      total_count: number;
      installations: GithubInstallation[];
    }>(userToken, `/user/installations?per_page=100&page=${page}`);
    installations.push(...result.installations);
    if (
      result.installations.length === 0 ||
      installations.length >= result.total_count
    ) {
      return installations;
    }
  }
}

export function toRepositoryFields(repository: GithubRepository) {
  return {
    githubRepoId: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    private: repository.private,
    defaultBranch: repository.default_branch,
  };
}

export async function verifyWebhookSignature(
  secret: string,
  body: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = hexToBytes(signatureHeader.slice("sha256=".length));
  if (signature === null) {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(body),
  );
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export type GithubRepositoryPermissions = {
  admin: boolean;
  maintain?: boolean;
  push: boolean;
  pull: boolean;
};

export async function getRepositoryPermissions(
  userToken: string,
  owner: string,
  name: string,
): Promise<GithubRepositoryPermissions | null> {
  try {
    const repository = await githubRequest<{
      permissions?: GithubRepositoryPermissions;
    }>(userToken, `/repos/${owner}/${name}`);
    return repository.permissions ?? null;
  } catch (error) {
    if (error instanceof GithubError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function isOrgOwner(
  userToken: string,
  org: string,
): Promise<boolean> {
  try {
    const membership = await githubRequest<{ state: string; role: string }>(
      userToken,
      `/user/memberships/orgs/${org}`,
    );
    return membership.state === "active" && membership.role === "admin";
  } catch (error) {
    if (error instanceof GithubError && error.status !== 401) {
      return false;
    }
    throw error;
  }
}

export async function isAncestor(
  installationToken: string,
  owner: string,
  name: string,
  base: string,
  head: string,
): Promise<boolean> {
  try {
    const { status } = await githubRequest<{ status: string }>(
      installationToken,
      `/repos/${owner}/${name}/compare/${base}...${head}?per_page=1`,
    );
    return status === "ahead" || status === "identical";
  } catch (error) {
    if (
      error instanceof GithubError &&
      (error.status === 404 || error.status === 422)
    ) {
      return false;
    }
    throw error;
  }
}

export async function findMergedPullRequest(
  installationToken: string,
  owner: string,
  name: string,
  commitSha: string,
  baseBranch: string,
): Promise<number | null> {
  const pulls = await githubRequest<
    { number: number; merged_at: string | null; base: { ref: string } }[]
  >(installationToken, `/repos/${owner}/${name}/commits/${commitSha}/pulls`);
  const merged = pulls.find(
    (pull) => pull.merged_at !== null && pull.base.ref === baseBranch,
  );
  return merged?.number ?? null;
}

export type CommitStatusFields = {
  state: "pending" | "success" | "failure" | "error";
  target_url: string;
  description: string;
  context: string;
};

export async function createCommitStatus(
  installationToken: string,
  owner: string,
  name: string,
  commitSha: string,
  fields: CommitStatusFields,
): Promise<void> {
  await githubRequest(
    installationToken,
    `/repos/${owner}/${name}/statuses/${commitSha}`,
    { method: "POST", body: JSON.stringify(fields) },
  );
}
