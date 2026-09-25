#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { compareCommand, parseThreshold } from "./commands/compare";
import { finalizeCommand } from "./commands/finalize";
import {
  parseDelay,
  parseViewports,
  storybookCommand,
} from "./commands/storybook";
import { parseShard, uploadCommand } from "./commands/upload";

const program = new Command()
  .name("stateofpixel")
  .description("Visual regression testing that runs in your CI")
  .version(packageJson.version);

program
  .command("compare")
  .description("Compare a folder of screenshots against a baseline folder")
  .argument("<dir>", "folder with new screenshots")
  .argument("<baseline-dir>", "folder with baseline screenshots")
  .option("--out <dir>", "report folder", "stateofpixel-report")
  .option(
    "--threshold <number>",
    "color difference threshold, 0 to 1",
    parseThreshold,
    0.1,
  )
  .option("--include-aa", "count anti-aliased pixels as changes", false)
  .action(compareCommand);

program
  .command("upload")
  .description(
    "Upload a folder of screenshots and compare it with the baseline",
  )
  .argument("<dir>", "folder with screenshots")
  .option(
    "--build-name <name>",
    "separate builds of one project, like storybook",
  )
  .option(
    "--shard <i/n>",
    "this shard and the shard count, or auto with a finalize step",
    parseShard,
  )
  .option("--nonce <id>", "shared by every shard of one build")
  .option("--baseline-branch <branch>", "branch to compare against")
  .option(
    "--subset",
    "only some snapshots ran, do not mark others removed",
    false,
  )
  .option(
    "--threshold <number>",
    "color difference threshold, 0 to 1, overrides project settings",
    parseThreshold,
  )
  .option("--strict", "fail when the service is not reachable", false)
  .option("--dry-run", "hash and print the plan, upload nothing", false)
  .action(uploadCommand);

program
  .command("storybook")
  .description("Capture every story of a built Storybook, then upload")
  .argument("<static-dir>", "the output of storybook build")
  .option(
    "--viewports <widths>",
    "comma separated viewport widths",
    parseViewports,
    [1280],
  )
  .option("--include <glob>", "only stories whose title/name match")
  .option("--exclude <glob>", "skip stories whose title/name match")
  .option(
    "--wait-for-selector <selector>",
    "wait for this before each screenshot",
    "#storybook-root > *",
  )
  .option(
    "--delay <ms>",
    "wait this long before each screenshot",
    parseDelay,
    0,
  )
  .option(
    "--build-name <name>",
    "separate builds of one project, like storybook",
  )
  .option(
    "--shard <i/n>",
    "this shard and the shard count, or auto with a finalize step",
    parseShard,
  )
  .option("--nonce <id>", "shared by every shard of one build")
  .option("--baseline-branch <branch>", "branch to compare against")
  .option(
    "--subset",
    "only some snapshots ran, do not mark others removed",
    false,
  )
  .option(
    "--threshold <number>",
    "color difference threshold, 0 to 1, overrides project settings",
    parseThreshold,
  )
  .option("--strict", "fail when the service is not reachable", false)
  .option("--dry-run", "capture and print the plan, upload nothing", false)
  .action(storybookCommand);

program
  .command("finalize")
  .description("Finish a build whose shards ran with --shard auto")
  .option("--build-name <name>", "the build name the shards used")
  .option("--nonce <id>", "the nonce the shards used")
  .option(
    "--baseline-branch <branch>",
    "branch to compare against, for --skip-if-empty",
  )
  .option(
    "--skip-if-empty",
    "create a build with no changes when no shard ran",
    false,
  )
  .option("--strict", "fail when the service is not reachable", false)
  .action(finalizeCommand);

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    `stateofpixel: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
