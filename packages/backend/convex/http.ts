import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handle as handleGithubWebhook } from "./githubWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/github/webhook",
  method: "POST",
  handler: handleGithubWebhook,
});

export default http;
