import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { webhook as handleDodoWebhook } from "./billing";
import {
  buildAction,
  createBuild,
  finalizeBuild,
  getBuild,
  whoami,
} from "./ciApi";
import { handle as handleGithubWebhook } from "./githubWebhook";
import { serve as serveImage } from "./images";
import { IMAGE_ROUTE } from "./lib/imageUrls";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/github/webhook",
  method: "POST",
  handler: handleGithubWebhook,
});

http.route({
  path: "/dodo/webhook",
  method: "POST",
  handler: handleDodoWebhook,
});

http.route({ pathPrefix: IMAGE_ROUTE, method: "GET", handler: serveImage });

http.route({
  path: "/api/v1/whoami",
  method: "GET",
  handler: whoami,
});

http.route({ path: "/api/v1/builds", method: "POST", handler: createBuild });

http.route({
  path: "/api/v1/builds/finalize",
  method: "POST",
  handler: finalizeBuild,
});

http.route({
  pathPrefix: "/api/v1/builds/",
  method: "POST",
  handler: buildAction,
});

http.route({
  pathPrefix: "/api/v1/builds/",
  method: "GET",
  handler: getBuild,
});

export default http;
