import { BackendError } from "./backend";

export function errorCode(error: unknown): string | null {
  return error instanceof BackendError ? String(error.data.code) : null;
}
