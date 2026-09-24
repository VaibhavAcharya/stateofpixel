import { ConvexError } from "convex/values";

export type CiErrorData = { status: number; code: string; message: string };

export function ciError(
  status: number,
  code: string,
  message: string,
): ConvexError<CiErrorData> {
  return new ConvexError({ status, code, message });
}

export function isCiErrorData(data: unknown): data is CiErrorData {
  return (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    typeof data.status === "number" &&
    "code" in data &&
    typeof data.code === "string" &&
    "message" in data &&
    typeof data.message === "string"
  );
}
