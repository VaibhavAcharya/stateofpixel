#!/usr/bin/env node
import { Command, Option } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { compareCommand, parseThreshold } from "./commands/compare";
import { finalizeCommand } from "./commands/finalize";
import {
  parseDelay,
  parseViewports,
  storybookCommand,
} from "./commands/storybook";
import { parseShard, uploadCommand } from "./commands/upload";
import { COMMANDS, type CommandSpec } from "./reference";

const PARSERS: Record<string, (value: string) => unknown> = {
  "--threshold <number>": parseThreshold,
  "--shard <i/n>": parseShard,
  "--viewports <widths>": parseViewports,
  "--delay <ms>": parseDelay,
};

const ACTIONS: Record<CommandSpec["name"], Parameters<Command["action"]>[0]> = {
  compare: compareCommand,
  upload: uploadCommand,
  storybook: storybookCommand,
  finalize: finalizeCommand,
};

const program = new Command()
  .name("stateofpixel")
  .description("Catch UI regressions before they merge")
  .version(packageJson.version);

for (const spec of COMMANDS) {
  const command = program.command(spec.name).description(spec.description);
  for (const argument of spec.arguments) {
    command.argument(argument.name, argument.description);
  }
  for (const option of spec.options) {
    const commanderOption = new Option(option.flags, option.description);
    const parse = PARSERS[option.flags];
    if (parse !== undefined) {
      commanderOption.argParser(parse);
    }
    if (option.default !== undefined) {
      commanderOption.default(option.default);
    }
    command.addOption(commanderOption);
  }
  command.action(ACTIONS[spec.name]);
}

try {
  await program.parseAsync();
} catch (error) {
  console.error(
    `stateofpixel: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
}
