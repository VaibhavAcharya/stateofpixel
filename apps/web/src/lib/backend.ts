import type { Api } from "@stateofpixel/backend/api";
import type {
  Kind,
  PaginationOptions,
  PaginationResult,
  FunctionArgs as ServerFunctionArgs,
  FunctionReference as ServerFunctionReference,
  FunctionReturnType as ServerFunctionReturnType,
} from "@stateofpixel/backend/server";
import {
  hashKey,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useQueryClient,
  useQuery as useTanstackQuery,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import type { z } from "zod";

declare const signature: unique symbol;

export type FunctionReference<
  K extends Kind = Kind,
  Args = any,
  Result = any,
> = {
  readonly name: string;
  readonly [signature]?: { kind: K; args: Args; result: Result };
};

export type FunctionArgs<Ref extends FunctionReference> = NonNullable<
  Ref[typeof signature]
>["args"];

export type FunctionReturnType<Ref extends FunctionReference> = NonNullable<
  Ref[typeof signature]
>["result"];

type ServerArgs<Ref extends ServerFunctionReference> =
  Ref["args"] extends z.ZodObject<infer Shape>
    ? z.input<z.ZodObject<Shape>>
    : ServerFunctionArgs<Ref>;

type ClientReference<Ref> = Ref extends ServerFunctionReference
  ? FunctionReference<
      Ref["kind"],
      ServerArgs<Ref>,
      ServerFunctionReturnType<Ref>
    >
  : never;

type ClientApi = {
  [Module in keyof Api]: {
    [Name in keyof Api[Module]]: ClientReference<Api[Module][Name]>;
  };
};

function namespace<T>(prefix: string | null): T {
  const cache = new Map<string, unknown>();
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string") {
          return undefined;
        }
        let value = cache.get(key);
        if (value === undefined) {
          value =
            prefix === null ? namespace(key) : { name: `${prefix}.${key}` };
          cache.set(key, value);
        }
        return value;
      },
    },
  ) as T;
}

export const api = namespace<ClientApi>(null);

type EmptyArgs<Ref extends FunctionReference> =
  Record<never, never> extends FunctionArgs<Ref> ? true : false;

type OptionalArgs<Ref extends FunctionReference> =
  EmptyArgs<Ref> extends true
    ? [args?: FunctionArgs<Ref>]
    : [args: FunctionArgs<Ref>];

type ArgsOrSkip<Ref extends FunctionReference> =
  EmptyArgs<Ref> extends true
    ? [args?: FunctionArgs<Ref> | "skip"]
    : [args: FunctionArgs<Ref> | "skip"];

export class BackendError extends Error {
  constructor(readonly data: { code: string } & Record<string, unknown>) {
    super(data.code);
    this.name = "BackendError";
  }
}

type RpcBody = {
  value?: unknown;
  error?: { code: string } & Record<string, unknown>;
};

export async function callBackend<Ref extends FunctionReference>(
  ref: Ref,
  ...[args]: OptionalArgs<Ref>
): Promise<FunctionReturnType<Ref>> {
  const response = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: ref.name, args: args ?? {} }),
  });
  const body = (await response.json().catch(() => null)) as RpcBody | null;
  if (response.status === 400 && body?.error !== undefined) {
    throw new BackendError(body.error);
  }
  if (!response.ok || body === null) {
    throw new Error(
      `${ref.name} failed: ${body?.error?.code ?? response.status}`,
    );
  }
  return body.value as FunctionReturnType<Ref>;
}

const BACKEND = "backend";
const SKIP_KEY = [BACKEND, "skip"];

export function queryKey<Ref extends FunctionReference<"query">>(
  ref: Ref,
  args: FunctionArgs<Ref>,
): QueryKey {
  return [BACKEND, ref.name, args];
}

function paginatedQueryKey(ref: FunctionReference, args: unknown): QueryKey {
  return [BACKEND, ref.name, args, "paginated"];
}

export function queryOptions<Ref extends FunctionReference<"query">>(
  ref: Ref,
  args: FunctionArgs<Ref>,
) {
  return {
    queryKey: queryKey(ref, args),
    queryFn: () => callBackend<FunctionReference>(ref, args),
  };
}

const LIVE_OPTIONS = {
  refetchInterval: 5000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  retry: (failureCount: number, error: Error) =>
    !(error instanceof BackendError) && failureCount < 3,
  throwOnError: (error: Error, query: { state: { data: unknown } }) =>
    error instanceof BackendError || query.state.data === undefined,
};

export function useQuery<Ref extends FunctionReference<"query">>(
  ref: Ref,
  ...[args]: ArgsOrSkip<Ref>
): FunctionReturnType<Ref> | undefined {
  const skip = args === "skip";
  const { data } = useTanstackQuery({
    ...(skip
      ? { queryKey: SKIP_KEY, queryFn: () => null }
      : queryOptions(ref, args ?? {})),
    enabled: !skip,
    ...LIVE_OPTIONS,
  });
  return data as FunctionReturnType<Ref> | undefined;
}

type PaginatedReference = FunctionReference<
  "query",
  { paginationOpts: PaginationOptions },
  PaginationResult<unknown>
>;

type PaginatedArgs<Ref extends PaginatedReference> = Omit<
  FunctionArgs<Ref>,
  "paginationOpts"
>;

type PaginatedData = InfiniteData<PaginationResult<unknown>, PaginationOptions>;

export type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export type UsePaginatedQueryReturnType<Ref extends PaginatedReference> = {
  results: FunctionReturnType<Ref>["page"][number][];
  status: PaginationStatus;
  isLoading: boolean;
  loadMore: (numItems: number) => void;
};

export function usePaginatedQuery<Ref extends PaginatedReference>(
  ref: Ref,
  args: PaginatedArgs<Ref> | "skip",
  { initialNumItems }: { initialNumItems: number },
): UsePaginatedQueryReturnType<Ref> {
  const skip = args === "skip";
  const nextNumItems = useRef(initialNumItems);
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: skip
        ? [...SKIP_KEY, "paginated"]
        : paginatedQueryKey(ref, args),
      queryFn: ({ pageParam }) =>
        callBackend<FunctionReference>(ref, {
          ...(skip ? {} : args),
          paginationOpts: pageParam,
        }) as Promise<PaginationResult<unknown>>,
      initialPageParam: {
        numItems: initialNumItems,
        cursor: null,
      } as PaginationOptions,
      getNextPageParam: (last: PaginationResult<unknown>) =>
        last.isDone
          ? undefined
          : { numItems: nextNumItems.current, cursor: last.continueCursor },
      enabled: !skip,
      ...LIVE_OPTIONS,
    });
  const results = useMemo(
    () => data?.pages.flatMap((page) => page.page) ?? [],
    [data],
  );
  const loadMore = useCallback(
    (numItems: number) => {
      if (hasNextPage && !isFetchingNextPage) {
        nextNumItems.current = numItems;
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );
  const status: PaginationStatus =
    data === undefined
      ? "LoadingFirstPage"
      : isFetchingNextPage
        ? "LoadingMore"
        : hasNextPage
          ? "CanLoadMore"
          : "Exhausted";
  return {
    results: results as FunctionReturnType<Ref>["page"][number][],
    status,
    isLoading: status === "LoadingFirstPage" || status === "LoadingMore",
    loadMore,
  };
}

export type OptimisticLocalStore = {
  getQuery<Ref extends FunctionReference<"query">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): FunctionReturnType<Ref> | undefined;
  setQuery<Ref extends FunctionReference<"query">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
    value: FunctionReturnType<Ref> | undefined,
  ): void;
  getAllQueries<Ref extends FunctionReference<"query">>(
    ref: Ref,
  ): {
    args: FunctionArgs<Ref>;
    value: FunctionReturnType<Ref> | undefined;
  }[];
};

type OptimisticUpdate<Args> = (store: OptimisticLocalStore, args: Args) => void;

export type ReactMutation<Ref extends FunctionReference> = ((
  ...args: OptionalArgs<Ref>
) => Promise<FunctionReturnType<Ref>>) & {
  withOptimisticUpdate(
    update: OptimisticUpdate<FunctionArgs<Ref>>,
  ): ReactMutation<Ref>;
};

export type ReactAction<Ref extends FunctionReference> = (
  ...args: OptionalArgs<Ref>
) => Promise<FunctionReturnType<Ref>>;

function splitPagination(args: unknown) {
  const { paginationOpts, ...rest } = args as {
    paginationOpts?: PaginationOptions;
  };
  return { paginationOpts, rest };
}

function optimisticStore(queryClient: QueryClient) {
  const previous = new Map<string, { key: QueryKey; data: unknown }>();
  const remember = (key: QueryKey) => {
    const hash = hashKey(key);
    if (!previous.has(hash)) {
      previous.set(hash, { key, data: queryClient.getQueryData(key) });
    }
  };
  const store: OptimisticLocalStore = {
    getQuery: (ref, args) => {
      const { paginationOpts, rest } = splitPagination(args);
      if (paginationOpts === undefined) {
        return queryClient.getQueryData(queryKey(ref, args));
      }
      const data = queryClient.getQueryData<PaginatedData>(
        paginatedQueryKey(ref, rest),
      );
      const index =
        data?.pageParams.findIndex(
          (param) => param.cursor === paginationOpts.cursor,
        ) ?? -1;
      return data?.pages[index];
    },
    setQuery: (ref, args, value) => {
      const { paginationOpts, rest } = splitPagination(args);
      if (paginationOpts === undefined) {
        const key = queryKey(ref, args);
        remember(key);
        queryClient.setQueryData(key, value);
        return;
      }
      const key = paginatedQueryKey(ref, rest);
      remember(key);
      queryClient.setQueryData<PaginatedData>(
        key,
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page, index) =>
              value !== undefined &&
              data.pageParams[index]?.cursor === paginationOpts.cursor
                ? value
                : page,
            ),
          },
      );
    },
    getAllQueries: (ref) =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: [BACKEND, ref.name] })
        .flatMap(({ queryKey: [, , args, paginated], state }) => {
          if (paginated === undefined) {
            return [{ args, value: state.data }];
          }
          const data = state.data as PaginatedData | undefined;
          return (
            data?.pages.map((page, index) => ({
              args: {
                ...(args as object),
                paginationOpts: data.pageParams[index],
              },
              value: page,
            })) ?? []
          );
        }),
  };
  const rollback = () => {
    for (const { key, data } of previous.values()) {
      queryClient.setQueryData(key, data);
    }
  };
  return { store, rollback };
}

function createMutation<Ref extends FunctionReference>(
  queryClient: QueryClient,
  ref: Ref,
  update: OptimisticUpdate<FunctionArgs<Ref>> | undefined,
): ReactMutation<Ref> {
  const mutate = async (...[args]: OptionalArgs<Ref>) => {
    let rollback = () => {};
    if (update !== undefined) {
      await queryClient.cancelQueries({ queryKey: [BACKEND] });
      const optimistic = optimisticStore(queryClient);
      update(optimistic.store, args ?? {});
      rollback = optimistic.rollback;
    }
    try {
      const result = await callBackend<FunctionReference>(ref, args);
      await queryClient.invalidateQueries({ queryKey: [BACKEND] });
      return result as FunctionReturnType<Ref>;
    } catch (error) {
      rollback();
      throw error;
    }
  };
  return Object.assign(mutate, {
    withOptimisticUpdate: (next: OptimisticUpdate<FunctionArgs<Ref>>) =>
      createMutation(queryClient, ref, next),
  }) as ReactMutation<Ref>;
}

export function useMutation<Ref extends FunctionReference<"mutation">>(
  ref: Ref,
): ReactMutation<Ref> {
  const queryClient = useQueryClient();
  return useMemo(
    () => createMutation(queryClient, ref, undefined),
    [queryClient, ref],
  );
}

export function useAction<Ref extends FunctionReference<"action">>(
  ref: Ref,
): ReactAction<Ref> {
  const queryClient = useQueryClient();
  return useMemo(
    () => createMutation(queryClient, ref, undefined),
    [queryClient, ref],
  );
}
