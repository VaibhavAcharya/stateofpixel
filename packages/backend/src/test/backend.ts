import { and, isNull, min } from "drizzle-orm";
import { vi } from "vitest";
import { database } from "../db/index.ts";
import { jobs } from "../schema.ts";
import {
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  type MutationCtx,
  run,
  runDueJobs,
  runInTransaction,
} from "../server.ts";

export const TEST_SITE = "https://stateofpixel.test";

function caller(userId: string | null) {
  const call = <Ref extends FunctionReference>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>> => run(ref, args, userId);
  return { query: call, mutation: call, action: call };
}

export function testBackend() {
  return {
    ...caller(null),
    withUser: (userId: string) => caller(userId),
    run: <T>(fn: (ctx: MutationCtx) => Promise<T>) => runInTransaction(fn),
    fetch: async (path: string, init?: RequestInit) => {
      const { handleHttp } = await import("../http.ts");
      const response = await handleHttp(
        new Request(new URL(path, TEST_SITE), init),
      );
      return response ?? new Response("Not found", { status: 404 });
    },
    runDueJobs: () => runDueJobs(),
    runAllJobs: async () => {
      for (;;) {
        await runDueJobs();
        const [next] = await database()
          .select({ runAt: min(jobs.runAt) })
          .from(jobs)
          .where(and(isNull(jobs.failedAt)));
        if (next?.runAt == null) {
          return;
        }
        vi.setSystemTime(Math.max(next.runAt, Date.now()));
      }
    },
  };
}

export type TestBackend = ReturnType<typeof testBackend>;
