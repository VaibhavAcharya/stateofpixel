import type { Id } from "@stateofpixel/backend/dataModel";
import { describe, expect, it } from "vitest";
import {
  groupStories,
  onlyBrowsers,
  representative,
  someBrowsersFirst,
  storyReviewState,
} from "./stories";
import type { SnapshotRow } from "./types";

const BROWSERS = ["chromium", "firefox", "webkit"];

function row(name: string, fields: Partial<SnapshotRow> = {}): SnapshotRow {
  return {
    id: name as Id<"snapshots">,
    name,
    diffStatus: "changed",
    reviewState: "pending",
    diffRatio: 0.01,
    browser: "chromium",
    ...fields,
  };
}

describe("groupStories", () => {
  it("puts snapshots that differ only in the suffix in one story", () => {
    const items = groupStories([
      row("Button [chromium 375]"),
      row("Button [firefox 375]", { browser: "firefox" }),
      row("Header [chromium 375]"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["story", "row"]);
    expect(items[0]).toMatchObject({ name: "Button", key: "changed:Button" });
  });

  it("sorts widths as numbers", () => {
    const [story] = groupStories([
      row("Button [chromium 1280]"),
      row("Button [chromium 375]"),
    ]);
    expect(
      story?.kind === "story" && story.rows.map((item) => item.name),
    ).toEqual(["Button [chromium 375]", "Button [chromium 1280]"]);
  });

  it("keeps a name without a suffix as its own row", () => {
    expect(groupStories([row("Button"), row("Button/All")])).toHaveLength(2);
  });
});

describe("representative", () => {
  it("opens the pending snapshot with the largest change", () => {
    const [story] = groupStories([
      row("Button [chromium 375]", { diffRatio: 0.5, reviewState: "approved" }),
      row("Button [chromium 768]", { diffRatio: 0.2 }),
      row("Button [chromium 1280]", { diffRatio: 0.3 }),
    ]);
    expect(story && representative(story).name).toBe("Button [chromium 1280]");
  });
});

describe("storyReviewState", () => {
  it("shows a rejection before pending and approved", () => {
    expect(
      storyReviewState([
        row("a", { reviewState: "approved" }),
        row("b", { reviewState: "rejected" }),
        row("c"),
      ]),
    ).toBe("rejected");
    expect(
      storyReviewState([row("a", { reviewState: "approved" }), row("b")]),
    ).toBe("pending");
  });
});

describe("onlyBrowsers", () => {
  it("lists the browsers when only some of them changed", () => {
    expect(onlyBrowsers([row("a", { browser: "firefox" })], BROWSERS)).toEqual([
      "firefox",
    ]);
  });

  it("is null when every browser changed or the build has one", () => {
    const rows = BROWSERS.map((browser) => row(browser, { browser }));
    expect(onlyBrowsers(rows, BROWSERS)).toBeNull();
    expect(onlyBrowsers([row("a")], ["chromium"])).toBeNull();
  });
});

describe("someBrowsersFirst", () => {
  it("moves rows that changed in some browsers to the top", () => {
    const items = groupStories([
      row("Button [chromium 375]"),
      row("Button [firefox 375]", { browser: "firefox" }),
      row("Button [webkit 375]", { browser: "webkit" }),
      row("Sign in [webkit 375]", { browser: "webkit" }),
    ]);
    expect(
      someBrowsersFirst(items, BROWSERS).map((entry) => entry.some),
    ).toEqual([true, false]);
  });
});
