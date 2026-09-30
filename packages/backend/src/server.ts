import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { z } from "zod";
import { type Database, database, first, one } from "./db/index.ts";
import { jobs } from "./schema.ts";

export class AppError extends Error {
  readonly data: { code: string } & Record<string, unknown>;

  constructor(data: { code: string } & Record<string, unknown>) {
    super(data.code);
    this.name = "AppError";
    this.data = data;
  }
}

export type Kind = "query" | "mutation" | "action";
export type Visibility = "public" | "internal";

export type Scheduler = {
  runAfter<Ref extends FunctionReference>(
    delayMs: number,
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<string>;
  runAt<Ref extends FunctionReference>(
    timestamp: number,
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<string>;
  cancel(jobId: string): Promise<void>;
};

export type QueryCtx = { db: Database; userId: string | null };

export type MutationCtx = QueryCtx & { scheduler: Scheduler };

export type ActionCtx = {
  userId: string | null;
  scheduler: Scheduler;
  runQuery<Ref extends FunctionReference<"query">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>>;
  runMutation<Ref extends FunctionReference<"mutation">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>>;
  runAction<Ref extends FunctionReference<"action">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<FunctionReturnType<Ref>>;
};

type CtxFor<K extends Kind> = K extends "query"
  ? QueryCtx
  : K extends "mutation"
    ? MutationCtx
    : ActionCtx;

export type FunctionReference<
  K extends Kind = Kind,
  V extends Visibility = Visibility,
  Args = any,
  Result = any,
> = {
  kind: K;
  visibility: V;
  args: z.ZodType<Args, any>;
  handler: (ctx: CtxFor<K>, args: Args) => Promise<Result>;
};

export type FunctionArgs<Ref extends FunctionReference> =
  Ref["args"] extends z.ZodObject<infer Shape>
    ? z.input<z.ZodObject<Shape>>
    : z.input<Ref["args"]>;

export type FunctionReturnType<Ref extends FunctionReference> = Awaited<
  ReturnType<Ref["handler"]>
>;

function builder<K extends Kind, V extends Visibility>(kind: K, visibility: V) {
  return <Shape extends z.ZodRawShape, Result>(definition: {
    args: Shape;
    handler: (
      ctx: CtxFor<K>,
      args: z.output<z.ZodObject<Shape>>,
    ) => Promise<Result>;
  }): FunctionReference<K, V, z.output<z.ZodObject<Shape>>, Result> & {
    args: z.ZodObject<Shape>;
  } => ({
    kind,
    visibility,
    args: z.object(definition.args),
    handler: definition.handler,
  });
}

export const query = builder("query", "public");
export const internalQuery = builder("query", "internal");
export const mutation = builder("mutation", "public");
export const internalMutation = builder("mutation", "internal");
export const action = builder("action", "public");
export const internalAction = builder("action", "internal");

export const paginationOptsValidator = z.object({
  numItems: z.number().int().positive(),
  cursor: z.string().nullable(),
});

export type PaginationOptions = z.infer<typeof paginationOptsValidator>;

export type PaginationResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

export async function paginate<T>(
  { numItems, cursor }: PaginationOptions,
  load: (limit: number, offset: number) => Promise<T[]>,
): Promise<PaginationResult<T>> {
  const offset = cursor === null ? 0 : Number(cursor);
  const rows = await load(numItems + 1, offset);
  const page = rows.slice(0, numItems);
  return {
    page,
    isDone: rows.length <= numItems,
    continueCursor: String(offset + page.length),
  };
}

type Modules = Record<string, Record<string, unknown>>;

let registered: Modules = {};
let names: Map<FunctionReference, string> | undefined;

export function registerModules(modules: Modules) {
  registered = modules;
  names = undefined;
}

function isReference(value: unknown): value is FunctionReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "handler" in value
  );
}

export function nameOf(ref: FunctionReference): string {
  if (names === undefined) {
    names = new Map();
    for (const [moduleName, exports] of Object.entries(registered)) {
      for (const [exportName, value] of Object.entries(exports)) {
        if (isReference(value)) {
          names.set(value, `${moduleName}.${exportName}`);
        }
      }
    }
  }
  const name = names.get(ref);
  if (name === undefined) {
    throw new Error("Function is not registered in api.ts");
  }
  return name;
}

export function lookup(name: string): FunctionReference | null {
  const [moduleName, exportName] = name.split(".");
  const value =
    moduleName === undefined || exportName === undefined
      ? undefined
      : registered[moduleName]?.[exportName];
  return isReference(value) ? value : null;
}

type Host = { kick?: () => Promise<void> };

let host: Host = {};

export function configureHost(next: Host) {
  host = next;
}

async function kickIfDue(runAt: number) {
  if (runAt <= Date.now() && host.kick !== undefined) {
    await host.kick().catch((error: unknown) => {
      console.error("Could not start the job worker", error);
    });
  }
}

function schedulerFor(
  db: Database,
  onScheduled: (runAt: number) => Promise<void> | void,
): Scheduler {
  const runAt: Scheduler["runAt"] = async (timestamp, ref, args) => {
    const job = one(
      await db
        .insert(jobs)
        .values({
          name: nameOf(ref),
          args: ref.args.parse(args),
          runAt: timestamp,
        })
        .returning({ _id: jobs._id }),
    );
    await onScheduled(timestamp);
    return job._id;
  };
  return {
    runAt,
    runAfter: (delayMs, ref, args) => runAt(Date.now() + delayMs, ref, args),
    cancel: async (jobId) => {
      await db
        .delete(jobs)
        .where(
          and(
            eq(jobs._id, jobId),
            isNull(jobs.lockedUntil),
            isNull(jobs.failedAt),
          ),
        );
    },
  };
}

const RETRYABLE = new Set(["40001", "40P01"]);
const MAX_ATTEMPTS = 8;

function pgCode(error: unknown): string | undefined {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if ("code" in cause && typeof cause.code === "string") {
      return cause.code;
    }
  }
  return undefined;
}

export async function transaction<T>(
  fn: (db: Database, onScheduled: (runAt: number) => void) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let earliest = Number.POSITIVE_INFINITY;
    try {
      const result = await database().transaction(
        (tx) =>
          fn(tx as unknown as Database, (runAt) => {
            earliest = Math.min(earliest, runAt);
          }),
        { isolationLevel: "serializable" },
      );
      await kickIfDue(earliest);
      return result;
    } catch (error) {
      const code = pgCode(error);
      if (
        code === undefined ||
        !RETRYABLE.has(code) ||
        attempt === MAX_ATTEMPTS
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 20 * attempt),
      );
    }
  }
}

export async function runQuery<Ref extends FunctionReference<"query">>(
  ref: Ref,
  args: FunctionArgs<Ref>,
  userId: string | null = null,
): Promise<FunctionReturnType<Ref>> {
  return ref.handler({ db: database(), userId }, ref.args.parse(args));
}

export async function runMutation<Ref extends FunctionReference<"mutation">>(
  ref: Ref,
  args: FunctionArgs<Ref>,
  userId: string | null = null,
): Promise<FunctionReturnType<Ref>> {
  const parsed = ref.args.parse(args);
  return transaction((db, onScheduled) =>
    ref.handler(
      { db, userId, scheduler: schedulerFor(db, onScheduled) },
      parsed,
    ),
  );
}

export async function runAction<Ref extends FunctionReference<"action">>(
  ref: Ref,
  args: FunctionArgs<Ref>,
  userId: string | null = null,
): Promise<FunctionReturnType<Ref>> {
  return ref.handler(actionCtx(userId), ref.args.parse(args));
}

function actionCtx(userId: string | null): ActionCtx {
  return {
    userId,
    scheduler: schedulerFor(database(), kickIfDue),
    runQuery: (ref, args) => runQuery(ref, args, userId),
    runMutation: (ref, args) => runMutation(ref, args, userId),
    runAction: (ref, args) => runAction(ref, args, userId),
  };
}

export async function run<Ref extends FunctionReference>(
  ref: Ref,
  args: FunctionArgs<Ref>,
  userId: string | null = null,
): Promise<FunctionReturnType<Ref>> {
  switch (ref.kind) {
    case "query":
      return runQuery(ref as FunctionReference<"query">, args, userId);
    case "mutation":
      return runMutation(ref as FunctionReference<"mutation">, args, userId);
    default:
      return runAction(ref as FunctionReference<"action">, args, userId);
  }
}

const JOB_LOCK_MS = 15 * 60 * 1000;

type Job = typeof jobs.$inferSelect;

async function claimJob(): Promise<Job | null> {
  const now = Date.now();
  const due = database()
    .select({ _id: jobs._id })
    .from(jobs)
    .where(
      and(
        lte(jobs.runAt, now),
        isNull(jobs.failedAt),
        or(isNull(jobs.lockedUntil), lt(jobs.lockedUntil, now)),
      ),
    )
    .orderBy(asc(jobs.runAt))
    .limit(1)
    .for("update", { skipLocked: true });
  return first(
    await database()
      .update(jobs)
      .set({ lockedUntil: now + JOB_LOCK_MS })
      .where(inArray(jobs._id, due))
      .returning(),
  );
}

async function runJob(job: Job) {
  const ref = lookup(job.name);
  try {
    if (ref === null) {
      throw new Error(`Unknown job ${job.name}`);
    }
    const args = ref.args.parse(job.args);
    if (ref.kind === "mutation") {
      await transaction(async (db, onScheduled) => {
        await ref.handler(
          { db, userId: null, scheduler: schedulerFor(db, onScheduled) },
          args,
        );
        await db.delete(jobs).where(eq(jobs._id, job._id));
      });
    } else {
      await run(ref, args);
      await database().delete(jobs).where(eq(jobs._id, job._id));
    }
  } catch (error) {
    console.error(`Job ${job.name} failed`, error);
    await database()
      .update(jobs)
      .set({ failedAt: Date.now(), error: String(error) })
      .where(eq(jobs._id, job._id));
  }
}

export async function runDueJobs(deadline = Number.POSITIVE_INFINITY) {
  while (Date.now() < deadline) {
    const job = await claimJob();
    if (job === null) {
      return;
    }
    await runJob(job);
  }
}

export async function schedule<Ref extends FunctionReference>(
  ref: Ref,
  args: FunctionArgs<Ref>,
): Promise<string> {
  return schedulerFor(database(), kickIfDue).runAfter(0, ref, args);
}

export async function runInTransaction<T>(
  fn: (ctx: MutationCtx) => Promise<T>,
): Promise<T> {
  return transaction((db, onScheduled) =>
    fn({ db, userId: null, scheduler: schedulerFor(db, onScheduled) }),
  );
}

export type HttpHandler = (request: Request) => Promise<Response>;

export function httpAction(
  handler: (ctx: ActionCtx, request: Request) => Promise<Response>,
): HttpHandler {
  return (request) => handler(actionCtx(null), request);
}
