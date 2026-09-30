import { httpActionGeneric, httpRouter } from "convex/server";

const SITE_URL = "https://stateofpixel.com";

const PATHS: Record<string, string> = {
  "/github/webhook": "/api/github/webhook",
  "/dodo/webhook": "/api/dodo/webhook",
};

const forward = httpActionGeneric(async (_ctx, request) => {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete("host");
  return fetch(
    `${SITE_URL}${PATHS[url.pathname] ?? url.pathname}${url.search}`,
    {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    },
  );
});

const http = httpRouter();

for (const method of ["GET", "POST"] as const) {
  http.route({ pathPrefix: "/api/v1/", method, handler: forward });
}
http.route({ path: "/github/webhook", method: "POST", handler: forward });
http.route({ path: "/dodo/webhook", method: "POST", handler: forward });

export default http;
