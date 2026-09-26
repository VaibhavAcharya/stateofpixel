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
import type * as billing from "../billing.js";
import type * as blobs from "../blobs.js";
import type * as builds from "../builds.js";
import type * as checks from "../checks.js";
import type * as ciApi from "../ciApi.js";
import type * as ciAuth from "../ciAuth.js";
import type * as crons from "../crons.js";
import type * as githubWebhook from "../githubWebhook.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as installations from "../installations.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_ciErrors from "../lib/ciErrors.js";
import type * as lib_ciRequests from "../lib/ciRequests.js";
import type * as lib_conclude from "../lib/conclude.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_history from "../lib/history.js";
import type * as lib_imageUrls from "../lib/imageUrls.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_matchesBranch from "../lib/matchesBranch.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_projectTokens from "../lib/projectTokens.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_urls from "../lib/urls.js";
import type * as me from "../me.js";
import type * as members from "../members.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as rateLimits from "../rateLimits.js";
import type * as retention from "../retention.js";
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
  billing: typeof billing;
  blobs: typeof blobs;
  builds: typeof builds;
  checks: typeof checks;
  ciApi: typeof ciApi;
  ciAuth: typeof ciAuth;
  crons: typeof crons;
  githubWebhook: typeof githubWebhook;
  http: typeof http;
  images: typeof images;
  installations: typeof installations;
  "lib/billing": typeof lib_billing;
  "lib/ciErrors": typeof lib_ciErrors;
  "lib/ciRequests": typeof lib_ciRequests;
  "lib/conclude": typeof lib_conclude;
  "lib/github": typeof lib_github;
  "lib/history": typeof lib_history;
  "lib/imageUrls": typeof lib_imageUrls;
  "lib/images": typeof lib_images;
  "lib/matchesBranch": typeof lib_matchesBranch;
  "lib/permissions": typeof lib_permissions;
  "lib/projectTokens": typeof lib_projectTokens;
  "lib/storage": typeof lib_storage;
  "lib/urls": typeof lib_urls;
  me: typeof me;
  members: typeof members;
  permissions: typeof permissions;
  projects: typeof projects;
  rateLimits: typeof rateLimits;
  retention: typeof retention;
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

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
