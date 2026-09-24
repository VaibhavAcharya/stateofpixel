#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { compareCommand, parseThreshold } from "./commands/compare";
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
  .option("--shard <i/n>", "this shard and the shard count", parseShard)
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

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    `stateofpixel: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
