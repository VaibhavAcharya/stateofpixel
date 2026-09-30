import { webhook as handleDodoWebhook } from "./billing.ts";
import {
  buildAction,
  createBuild,
  finalizeBuild,
  getBuild,
  whoami,
} from "./ciApi.ts";
import { handle as handleGithubWebhook } from "./githubWebhook.ts";
import type { HttpHandler } from "./server.ts";

type Route = {
  method: "GET" | "POST";
  path: string;
  prefix?: boolean;
  handler: HttpHandler;
};

const routes: Route[] = [
  { method: "POST", path: "/api/github/webhook", handler: handleGithubWebhook },
  { method: "POST", path: "/api/dodo/webhook", handler: handleDodoWebhook },
  { method: "GET", path: "/api/v1/whoami", handler: whoami },
  { method: "POST", path: "/api/v1/builds", handler: createBuild },
  { method: "POST", path: "/api/v1/builds/finalize", handler: finalizeBuild },
  {
    method: "POST",
    path: "/api/v1/builds/",
    prefix: true,
    handler: buildAction,
  },
  { method: "GET", path: "/api/v1/builds/", prefix: true, handler: getBuild },
];

export async function handleHttp(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const route = routes.find(
    (candidate) =>
      candidate.method === request.method &&
      (candidate.prefix
        ? pathname.startsWith(candidate.path)
        : pathname === candidate.path),
  );
  return route === undefined ? null : route.handler(request);
}
