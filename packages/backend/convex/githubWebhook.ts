import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, httpAction, internalMutation } from "./_generated/server";
import { toRepositoryFields, verifyWebhookSignature } from "./lib/github";

const INSTALLATION_ACTIONS_TO_SYNC = new Set([
  "created",
  "new_permissions_accepted",
  "suspend",
  "unsuspend",
]);

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

  const payload: unknown = JSON.parse(body);
  if (!isObject(payload)) {
    return new Response("Invalid payload", { status: 400 });
  }

  await ctx.runMutation(internal.githubWebhook.receive, {
    deliveryId,
    event,
    action: typeof payload.action === "string" ? payload.action : null,
    installationId: readInstallationId(payload),
    repository: readRepository(payload),
  });
  return new Response(null, { status: 204 });
});

export const receive = internalMutation({
  args: {
    deliveryId: v.string(),
    event: v.string(),
    action: v.union(v.string(), v.null()),
    installationId: v.union(v.number(), v.null()),
    repository: v.union(
      v.object({
        githubRepoId: v.number(),
        owner: v.string(),
        name: v.string(),
        private: v.boolean(),
        defaultBranch: v.string(),
      }),
      v.null(),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query("githubEvents")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (seen !== null) {
      return null;
    }
    await ctx.db.insert("githubEvents", {
      deliveryId: args.deliveryId,
      event: args.event,
    });

    if (args.installationId === null) {
      return null;
    }
    const installationId = args.installationId;

    if (args.event === "installation" && args.action === "deleted") {
      await ctx.runMutation(internal.installations.uninstall, {
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
      await ctx.runMutation(internal.installations.updateRepository, {
        repository: args.repository,
      });
    }
    return null;
  },
});

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
