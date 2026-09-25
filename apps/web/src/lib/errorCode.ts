import { ConvexError } from "convex/values";

export function errorCode(error: unknown): string | null {
  return error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    "code" in error.data
    ? String(error.data.code)
    : null;
}
