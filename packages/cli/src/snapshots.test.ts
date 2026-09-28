import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { collectSnapshots } from "./snapshots";
import { encodePng, writeFixture } from "./test/png-fixtures";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "stateofpixel-snapshots-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("names snapshots by their path without the extension", async () => {
  await writeFixture(dir, "components/Button/primary", encodePng(1, 1));
  await writeFixture(dir, "home", encodePng(1, 1));
  await writeFile(path.join(dir, "notes.txt"), "not a screenshot");

  const snapshots = await collectSnapshots(dir);

  expect([...snapshots.keys()]).toEqual(["components/Button/primary", "home"]);
  expect(snapshots.get("home")).toBe(path.join(dir, "home.png"));
});
