import { useAuthActions } from "@convex-dev/auth/react";
import type { Decorator, Preview } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { usePaginatedQuery, useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo } from "react";
import { mocked, sb } from "storybook/test";
import { accountAvatar } from "../src/components/ui";
import { avatar, STORY_NOW } from "../src/lib/storyFixtures";
import { useBilling } from "../src/lib/useBilling";
import "../src/styles.css";

sb.mock(import("convex-helpers/react/cache/hooks"));
sb.mock(import("@convex-dev/auth/react"));
sb.mock("../src/lib/useBilling.ts");
sb.mock("../src/components/ui.tsx", { spy: true });

const withRouter: Decorator = (Story, { parameters }) => {
  const path: string = parameters.path ?? "/";
  const router = useMemo(
    () =>
      createRouter({
        routeTree: createRootRoute(),
        history: createMemoryHistory({ initialEntries: [path] }),
      }),
    [path],
  );
  return (
    <RouterContextProvider router={router}>
      <Story />
    </RouterContextProvider>
  );
};

const client = {
  setAuth: (_fetchToken: unknown, onChange: (authenticated: boolean) => void) =>
    onChange(true),
  clearAuth: () => {},
  mutation: async () => null,
  action: async () => null,
} as unknown as ConvexReactClient;

const fetchAccessToken = async () => null;

const withConvex: Decorator = (Story, { parameters }) => {
  const auth = { isLoading: false, isAuthenticated: false, ...parameters.auth };
  return (
    <ConvexProviderWithAuth
      client={client}
      useAuth={() => ({ ...auth, fetchAccessToken })}
    >
      <Story />
    </ConvexProviderWithAuth>
  );
};

const withTheme: Decorator = (Story, { globals, parameters }) => {
  document.documentElement.dataset.theme = parameters.theme ?? globals.theme;
  return <Story />;
};

const preview: Preview = {
  decorators: [withConvex, withRouter, withTheme],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: { icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  beforeEach({ parameters }) {
    const now = Date.now;
    Date.now = () => STORY_NOW;
    const queries = parameters.convex ?? {};
    mocked(useQuery).mockImplementation(
      (query, ..._args) => queries[getFunctionName(query)],
    );
    mocked(usePaginatedQuery).mockImplementation(
      (query, ..._args) =>
        queries[getFunctionName(query)] ?? {
          results: [],
          status: "LoadingFirstPage",
          isLoading: true,
          loadMore: () => {},
        },
    );
    mocked(useAuthActions).mockReturnValue({
      signIn: async () => ({ signingIn: true }),
      signOut: async () => {},
    });
    mocked(accountAvatar).mockImplementation(avatar);
    mocked(useBilling).mockReturnValue({
      pending: false,
      error: null,
      change: null,
      checkout: async () => {},
      manage: async () => {},
      startChange: async () => {},
      confirmChange: async () => {},
      cancelChange: () => {},
      ...parameters.billing,
    });
    return () => {
      Date.now = now;
    };
  },
};

export default preview;
