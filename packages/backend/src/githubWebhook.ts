import { eq } from "drizzle-orm";
import { z } from "zod";
import { internal } from "./api.ts";
import { first } from "./db/index.ts";
import { env } from "./env.ts";
import { toRepositoryFields, verifyWebhookSignature } from "./lib/github.ts";
import { githubEvents } from "./schema.ts";
import { httpAction, internalMutation } from "./server.ts";

const INSTALLATION_ACTIONS_TO_SYNC = new Set([
  "created",
  "new_permissions_accepted",
  "suspend",
  "unsuspend",
]);

const PULL_REQUEST_ACTIONS = new Set(["closed", "reopened"]);

const REPOSITORY_ACTIONS_TO_UPDATE = new Set([
  "edited",
  "renamed",
  "transferred",
  "privatized",
  "publicized",
]);

export const handle = httpAction(async (ctx, request) => {
  const body = await request.text();
  const valid = await verifyWebhookSignature(
    env.GITHUB_WEBHOOK_SECRET,
    body,
    request.headers.get("X-Hub-Signature-256"),
  );
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const deliveryId = request.headers.get("X-GitHub-Delivery");
  const event = request.headers.get("X-GitHub-Event");
  if (deliveryId === null || event === null) {
    return new Response("Missing delivery headers", { status: 400 });
  }

  const payload = parseJson(body);
  if (!isObject(payload)) {
    return new Response("Invalid payload", { status: 400 });
  }

  await ctx.runMutation(internal.githubWebhook.receive, {
    deliveryId,
    event,
    action: typeof payload.action === "string" ? payload.action : null,
    installationId: readInstallationId(payload),
    repository: readRepository(payload),
    pullRequestNumber: readPullRequestNumber(payload),
    pullRequestMerged: readPullRequestMerged(payload),
  });
  return new Response(null, { status: 204 });
});

export const receive = internalMutation({
  args: {
    deliveryId: z.string(),
    event: z.string(),
    action: z.string().nullable(),
    installationId: z.number().nullable(),
    repository: z
      .object({
        providerRepoId: z.number(),
        owner: z.string(),
        name: z.string(),
        private: z.boolean(),
        defaultBranch: z.string(),
      })
      .nullable(),
    pullRequestNumber: z.number().nullable().optional(),
    pullRequestMerged: z.boolean().optional(),
  },
  handler: async (ctx, args) => {
    const seen = first(
      await ctx.db
        .select()
        .from(githubEvents)
        .where(eq(githubEvents.deliveryId, args.deliveryId)),
    );
    if (seen !== null) {
      return null;
    }
    await ctx.db.insert(githubEvents).values({
      deliveryId: args.deliveryId,
      event: args.event,
    });

    if (args.installationId === null) {
      return null;
    }
    const installationId = args.installationId;

    if (args.event === "installation" && args.action === "deleted") {
      await internal.installations.uninstall.handler(ctx, {
        installationId,
      });
    } else if (
      (args.event === "installation" &&
        INSTALLATION_ACTIONS_TO_SYNC.has(args.action ?? "")) ||
      args.event === "installation_repositories"
    ) {
      await ctx.scheduler.runAfter(0, internal.installations.sync, {
        installationId,
      });
    } else if (
      args.event === "repository" &&
      REPOSITORY_ACTIONS_TO_UPDATE.has(args.action ?? "") &&
      args.repository !== null
    ) {
      await internal.installations.updateRepository.handler(ctx, {
        repository: args.repository,
      });
    } else if (
      args.event === "pull_request" &&
      PULL_REQUEST_ACTIONS.has(args.action ?? "") &&
      args.repository !== null &&
      typeof args.pullRequestNumber === "number"
    ) {
      await internal.retention.setPrClosed.handler(ctx, {
        providerRepoId: args.repository.providerRepoId,
        prNumber: args.pullRequestNumber,
        closed: args.action === "closed",
        merged: args.pullRequestMerged,
      });
    }
    return null;
  },
});

function readPullRequestNumber(payload: Record<string, unknown>) {
  const pullRequest = payload.pull_request;
  return isObject(pullRequest) && typeof pullRequest.number === "number"
    ? pullRequest.number
    : null;
}

function readPullRequestMerged(payload: Record<string, unknown>) {
  const pullRequest = payload.pull_request;
  return isObject(pullRequest) && pullRequest.merged === true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readInstallationId(payload: Record<string, unknown>): number | null {
  const installation = payload.installation;
  return isObject(installation) && typeof installation.id === "number"
    ? installation.id
    : null;
}

function readRepository(payload: Record<string, unknown>) {
  const repository = payload.repository;
  if (
    !isObject(repository) ||
    typeof repository.id !== "number" ||
    typeof repository.name !== "string" ||
    !isObject(repository.owner) ||
    typeof repository.owner.login !== "string" ||
    typeof repository.private !== "boolean" ||
    typeof repository.default_branch !== "string"
  ) {
    return null;
  }
  return toRepositoryFields({
    id: repository.id,
    name: repository.name,
    owner: { login: repository.owner.login },
    private: repository.private,
    default_branch: repository.default_branch,
  });
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
