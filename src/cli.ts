#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig, setConfigPath, type OutputFormat } from "./config/index.js";

// Import commands
import { registerSearchCommand } from "./cli/commands/search.js";
import { registerListCommand } from "./cli/commands/list.js";
import { registerGetCommand } from "./cli/commands/get.js";
import { registerAddCommand } from "./cli/commands/add.js";
import { registerUpdateCommand } from "./cli/commands/update.js";
import { registerDeleteCommand } from "./cli/commands/delete.js";
import { registerLinkCommand } from "./cli/commands/link.js";
import { registerReembedCommand } from "./cli/commands/reembed.js";
import { registerExportCommand } from "./cli/commands/export.js";
import { registerImportCommand } from "./cli/commands/import.js";
import { registerStatsCommand } from "./cli/commands/stats.js";
import { registerConfigCommand } from "./cli/commands/config.js";

// Read package.json version
const VERSION = "0.1.0";

const program = new Command();

program
  .name("code-ltm-cli")
  .description("CLI for managing code-ltm learnings")
  .version(VERSION)
  .option("--config <path>", "Config file path")
  .option("--db <path>", "Database path (overrides config)")
  .option(
    "-f, --format <type>",
    "Output format: table, json, yaml",
    "table"
  )
  .hook("preAction", (thisCommand) => {
    // Load config before any command runs
    const opts = thisCommand.opts();

    if (opts.config) {
      setConfigPath(opts.config);
    }

    // Build CLI overrides from command-line options
    const cliOverrides: Record<string, unknown> = {};

    if (opts.db) {
      cliOverrides.database = { path: opts.db };
    }

    if (opts.format) {
      cliOverrides.cli = { output_format: opts.format as OutputFormat };
    }

    // Load config with overrides
    loadConfig(cliOverrides as Parameters<typeof loadConfig>[0]);
  });

// Register all commands
registerSearchCommand(program);
registerListCommand(program);
registerGetCommand(program);
registerAddCommand(program);
registerUpdateCommand(program);
registerDeleteCommand(program);
registerLinkCommand(program);
registerReembedCommand(program);
registerExportCommand(program);
registerImportCommand(program);
registerStatsCommand(program);
registerConfigCommand(program);

// Parse and run
program.parse();
