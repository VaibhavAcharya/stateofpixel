/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as auth from "../auth.js";
import type * as baselines from "../baselines.js";
import type * as blobs from "../blobs.js";
import type * as builds from "../builds.js";
import type * as checks from "../checks.js";
import type * as ciApi from "../ciApi.js";
import type * as ciAuth from "../ciAuth.js";
import type * as crons from "../crons.js";
import type * as githubWebhook from "../githubWebhook.js";
import type * as http from "../http.js";
import type * as installations from "../installations.js";
import type * as lib_ciErrors from "../lib/ciErrors.js";
import type * as lib_ciRequests from "../lib/ciRequests.js";
import type * as lib_conclude from "../lib/conclude.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_history from "../lib/history.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_projectTokens from "../lib/projectTokens.js";
import type * as lib_urls from "../lib/urls.js";
import type * as me from "../me.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as reviews from "../reviews.js";
import type * as snapshots from "../snapshots.js";
import type * as tokens from "../tokens.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  auth: typeof auth;
  baselines: typeof baselines;
  blobs: typeof blobs;
  builds: typeof builds;
  checks: typeof checks;
  ciApi: typeof ciApi;
  ciAuth: typeof ciAuth;
  crons: typeof crons;
  githubWebhook: typeof githubWebhook;
  http: typeof http;
  installations: typeof installations;
  "lib/ciErrors": typeof lib_ciErrors;
  "lib/ciRequests": typeof lib_ciRequests;
  "lib/conclude": typeof lib_conclude;
  "lib/github": typeof lib_github;
  "lib/history": typeof lib_history;
  "lib/images": typeof lib_images;
  "lib/permissions": typeof lib_permissions;
  "lib/projectTokens": typeof lib_projectTokens;
  "lib/urls": typeof lib_urls;
  me: typeof me;
  permissions: typeof permissions;
  projects: typeof projects;
  reviews: typeof reviews;
  snapshots: typeof snapshots;
  tokens: typeof tokens;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
