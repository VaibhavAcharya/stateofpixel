import { httpAction } from "./_generated/server";
import { authenticateCi } from "./ciAuth";

export const whoami = httpAction(async (ctx, request) => {
  const auth = await authenticateCi(ctx, request);
  if (auth === null) {
    return errorResponse(
      401,
      "unauthorized",
      "Use a GitHub Actions OIDC token with audience stateofpixel, or a project token.",
    );
  }
  return Response.json({
    project: auth.project.fullName,
    method: auth.method,
  });
});

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status });
}
