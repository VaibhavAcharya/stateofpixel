#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { compareCommand, parseThreshold } from "./commands/compare";

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

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    `stateofpixel: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
