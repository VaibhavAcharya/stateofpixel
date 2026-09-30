import { and, eq } from "drizzle-orm";
import type { Database } from "./db/index.ts";
import { first } from "./db/index.ts";
import {
  CI_REQUESTS_PER_MINUTE,
  DAILY_BUILDS,
  DAILY_UPLOAD_BYTES,
} from "./lib/limits.ts";
import { rateLimits } from "./schema.ts";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

type Config = {
  kind: "token bucket" | "fixed window";
  rate: number;
  period: number;
};

const CONFIGS = {
  ciRequests: {
    kind: "token bucket",
    rate: CI_REQUESTS_PER_MINUTE,
    period: MINUTE,
  },
  builds: { kind: "fixed window", rate: DAILY_BUILDS, period: DAY },
  uploadedBytes: {
    kind: "fixed window",
    rate: DAILY_UPLOAD_BYTES,
    period: DAY,
  },
} satisfies Record<string, Config>;

type Name = keyof typeof CONFIGS;

type Request = { key: string; count?: number; reserve?: boolean };

type Result =
  | { ok: true; retryAfter?: number }
  | { ok: false; retryAfter: number };

function calculate(
  existing: { value: number; ts: number } | null,
  config: Config,
  now: number,
  count: number,
) {
  const state = existing ?? {
    value: config.rate,
    ts:
      config.kind === "fixed window"
        ? now - Math.floor(Math.random() * config.period)
        : now,
  };
  if (config.kind === "token bucket") {
    const rate = config.rate / config.period;
    const value =
      Math.min(state.value + (now - state.ts) * rate, config.rate) - count;
    return {
      value,
      ts: now,
      retryAfter: value < 0 ? -value / rate : undefined,
    };
  }
  const elapsedWindows = Math.floor((now - state.ts) / config.period);
  const value =
    Math.min(state.value + config.rate * elapsedWindows, config.rate) - count;
  const ts = state.ts + elapsedWindows * config.period;
  return {
    value,
    ts,
    retryAfter:
      value < 0
        ? ts + config.period * Math.ceil(-value / config.rate) - now
        : undefined,
  };
}

async function read(ctx: { db: Database }, name: Name, key: string) {
  const row = first(
    await ctx.db
      .select()
      .from(rateLimits)
      .where(and(eq(rateLimits.name, name), eq(rateLimits.key, key))),
  );
  return row;
}

function evaluate(
  existing: { value: number; ts: number } | null,
  name: Name,
  { count = 1, reserve = false }: Omit<Request, "key">,
) {
  const state = calculate(existing, CONFIGS[name], Date.now(), count);
  const result: Result =
    state.value < 0 && !reserve
      ? { ok: false, retryAfter: state.retryAfter ?? 0 }
      : { ok: true, retryAfter: state.retryAfter };
  return { state, result };
}

export const rateLimiter = {
  async check(
    ctx: { db: Database },
    name: Name,
    request: Request,
  ): Promise<Result> {
    return evaluate(await read(ctx, name, request.key), name, request).result;
  },

  async limit(
    ctx: { db: Database },
    name: Name,
    request: Request,
  ): Promise<Result> {
    const { state, result } = evaluate(
      await read(ctx, name, request.key),
      name,
      request,
    );
    if (result.ok) {
      const row = { value: state.value, ts: state.ts };
      await ctx.db
        .insert(rateLimits)
        .values({ name, key: request.key, ...row })
        .onConflictDoUpdate({
          target: [rateLimits.name, rateLimits.key],
          set: row,
        });
    }
    return result;
  },

  async reset(ctx: { db: Database }, name: Name, { key }: { key: string }) {
    await ctx.db
      .delete(rateLimits)
      .where(and(eq(rateLimits.name, name), eq(rateLimits.key, key)));
  },
};
