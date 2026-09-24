#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };

const program = new Command()
  .name("stateofpixel")
  .description("Visual regression testing that runs in your CI")
  .version(packageJson.version);

program.parse();
