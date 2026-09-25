import { expect, it } from "vitest";
import {
  filterStories,
  parseViewports,
  type Story,
  storySnapshotName,
} from "./storybook";

const stories: Story[] = [
  { id: "button--primary", title: "Components/Button", name: "Primary" },
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

it("names a story snapshot after its title, name and viewport", () => {
  expect(storySnapshotName(stories[0] as Story, 375)).toBe(
    "Components/Button/Primary [chromium 375]",
  );
});

it("parses viewport widths", () => {
  expect(parseViewports("375, 1280")).toEqual([375, 1280]);
  expect(() => parseViewports("wide")).toThrow("Must look like 375,1280.");
});
