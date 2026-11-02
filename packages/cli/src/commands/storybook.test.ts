import { expect, it } from "vitest";
import {
  filterStories,
  parseGlobals,
  parseViewports,
  type Story,
  shardStories,
  storybookCommand,
  storySnapshotName,
} from "./storybook";

const stories: Story[] = [
  {
    id: "button--primary",
    title: "Components/Button",
    name: "Primary",
    tags: ["dev", "snapshot"],
  },
  { id: "button--secondary", title: "Components/Button", name: "Secondary" },
  { id: "home--default", title: "Pages/Home", name: "Default" },
];

it("filters stories by title and name globs", () => {
  expect(
    filterStories(stories, "Components/**", undefined).map((s) => s.id),
  ).toEqual(["button--primary", "button--secondary"]);
  expect(
    filterStories(stories, undefined, "*/Button/Secondary").map((s) => s.id),
  ).toEqual(["button--primary", "home--default"]);
  expect(filterStories(stories, "Pages/*", undefined)).toEqual([]);
});

it("filters stories by tag", () => {
  expect(
    filterStories(stories, undefined, undefined, "snapshot").map((s) => s.id),
  ).toEqual(["button--primary"]);
});

it("splits stories between shards", () => {
  const ids = (index: number) =>
    shardStories(stories, { index, total: 2 }).map((s) => s.id);
  expect(ids(1)).toEqual(["button--primary", "home--default"]);
  expect(ids(2)).toEqual(["button--secondary"]);
  expect(shardStories(stories, { index: null, total: null })).toEqual(stories);
});

it("names a story snapshot after its title, name and viewport", () => {
  expect(storySnapshotName(stories[0] as Story, 375)).toBe(
    "Components/Button/Primary [chromium 375]",
  );
});

it("parses viewport widths", () => {
  expect(parseViewports("375, 1280")).toEqual([375, 1280]);
  expect(() => parseViewports("wide")).toThrow("Must look like 375,1280.");
});

it("parses Storybook globals", () => {
  expect(parseGlobals("brand:new;theme:dark")).toBe("brand:new;theme:dark");
  expect(() => parseGlobals("brand")).toThrow(
    "Must look like brand:new;theme:dark.",
  );
});

it("refuses --shard auto, which cannot split stories", async () => {
  await expect(
    storybookCommand("storybook-static", {
      shard: { index: null, total: null },
      viewports: [1280],
      waitForSelector: "#storybook-root",
      delay: 0,
    } as Parameters<typeof storybookCommand>[1]),
  ).rejects.toThrow(/--shard i\/n/);
});
