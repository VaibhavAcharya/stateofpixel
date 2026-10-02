import * as accounts from "./accounts.ts";
import * as auth from "./auth.ts";
import * as baselines from "./baselines.ts";
import * as billing from "./billing.ts";
import * as blobs from "./blobs.ts";
import * as builds from "./builds.ts";
import * as checks from "./checks.ts";
import * as ciAuth from "./ciAuth.ts";
import * as comments from "./comments.ts";
import * as connections from "./connections.ts";
import * as githubWebhook from "./githubWebhook.ts";
import * as images from "./images.ts";
import * as installations from "./installations.ts";
import * as me from "./me.ts";
import * as members from "./members.ts";
import * as permissions from "./permissions.ts";
import * as projects from "./projects.ts";
import * as retention from "./retention.ts";
import * as reviews from "./reviews.ts";
import { type FunctionReference, registerModules } from "./server.ts";
import * as snapshots from "./snapshots.ts";
import * as tokens from "./tokens.ts";
import * as usage from "./usage.ts";
import * as users from "./users.ts";

const modules = {
  accounts,
  auth,
  baselines,
  billing,
  blobs,
  builds,
  checks,
  comments,
  ciAuth,
  connections,
  githubWebhook,
  images,
  installations,
  me,
  members,
  permissions,
  projects,
  retention,
  reviews,
  snapshots,
  tokens,
  usage,
  users,
};

registerModules(modules);

export const api = modules;
export const internal = modules;

type PublicFunctions<Module> = {
  [Name in keyof Module as Module[Name] extends FunctionReference<
    infer _Kind,
    "public"
  >
    ? Name
    : never]: Module[Name];
};

export type Api = {
  [Module in keyof typeof modules]: PublicFunctions<(typeof modules)[Module]>;
};
