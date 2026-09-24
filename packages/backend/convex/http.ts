import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { whoami } from "./ciApi";
import { handle as handleGithubWebhook } from "./githubWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/github/webhook",
  method: "POST",
  handler: handleGithubWebhook,
});

http.route({
  path: "/api/v1/whoami",
  method: "GET",
  handler: whoami,
});

export default http;
