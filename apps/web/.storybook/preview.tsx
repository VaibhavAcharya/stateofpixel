import type { Decorator, Preview } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { getFunctionName } from "convex/server";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { mocked, sb } from "storybook/test";
import { STORY_NOW } from "../src/lib/storyFixtures";
import { useBilling } from "../src/lib/useBilling";
import "../src/styles.css";

sb.mock(import("convex-helpers/react/cache/hooks"));
sb.mock(import("../src/lib/useBilling"));

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
});

const withRouter: Decorator = (Story) => (
  <RouterContextProvider router={router}>
    <Story />
  </RouterContextProvider>
);

const withTheme: Decorator = (Story, { globals }) => {
  document.documentElement.dataset.theme = globals.theme;
  return <Story />;
};

const preview: Preview = {
  decorators: [withRouter, withTheme],
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
    mocked(useQuery).mockImplementation(
      (query, ..._args) => parameters.convex?.[getFunctionName(query)],
    );
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
