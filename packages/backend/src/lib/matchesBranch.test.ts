import { expect, it } from "vitest";
import { matchesBranch } from "./matchesBranch.ts";

it("matches branch globs", () => {
  expect(matchesBranch("main", "main")).toBe(true);
  expect(matchesBranch("main", "main2")).toBe(false);
  expect(matchesBranch("release/*", "release/1.2")).toBe(true);
  expect(matchesBranch("release/*", "release/1/hotfix")).toBe(false);
  expect(matchesBranch("release/**", "release/1/hotfix")).toBe(true);
  expect(matchesBranch("v1.x", "v1x")).toBe(false);
});
