import type { Decorator, Preview } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";
import { mocked, sb, spyOn } from "storybook/test";
import { accountAvatar } from "../src/components/ui";
import { AuthContext, authActions } from "../src/lib/auth";
import { queryKey } from "../src/lib/backend";
import { avatar, STORY_NOW } from "../src/lib/storyFixtures";
import { useBilling } from "../src/lib/useBilling";
import "../src/styles.css";

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

const withBackend: Decorator = (Story, { parameters }) => {
  const queryClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          queryKeyHashFn: (key) => String(key[1]),
          staleTime: Number.POSITIVE_INFINITY,
        },
      },
    });
    for (const [name, value] of Object.entries(parameters.backend ?? {})) {
      client.setQueryData(queryKey({ name }, {}), value);
    }
    return client;
  }, [parameters.backend]);
  const auth = { isLoading: false, isAuthenticated: false, ...parameters.auth };
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <Story />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

const withTheme: Decorator = (Story, { globals, parameters }) => {
  document.documentElement.dataset.theme = parameters.theme ?? globals.theme;
  return <Story />;
};

const preview: Preview = {
  decorators: [withBackend, withRouter, withTheme],
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
    const fetch = window.fetch;
    window.fetch = (input, init) =>
      String(input) === "/api/rpc" ? new Promise(() => {}) : fetch(input, init);
    const signIn = spyOn(authActions, "signIn").mockImplementation(
      async () => {},
    );
    const signOut = spyOn(authActions, "signOut").mockImplementation(
      async () => {},
    );
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
      window.fetch = fetch;
      signIn.mockRestore();
      signOut.mockRestore();
    };
  },
};

export default preview;
