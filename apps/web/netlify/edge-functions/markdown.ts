export default async (request: Request) => {
  if (!request.headers.get("accept")?.includes("text/markdown")) {
    return;
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const markdown = await fetch(new URL(`${path || "/index"}.md`, url));
  if (!markdown.ok) {
    return;
  }
  const headers = new Headers(markdown.headers);
  headers.set("Vary", "Accept");
  return new Response(markdown.body, { headers });
};

export const config = {
  path: "/*",
  excludedPath: [
    "/*.md",
    "/*.txt",
    "/.netlify/*",
    "/api/*",
    "/assets/*",
    "/og/*",
  ],
};
