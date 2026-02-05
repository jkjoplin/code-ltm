import { Command } from "commander";
import { getConfig, getConfigPath, writeDefaultConfig } from "../../config/index.js";
import { formatOutput, formatConfig, printSuccess, printInfo } from "../output.js";

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Show or manage configuration");

  configCmd
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const config = getConfig();

      if (config.cli.output_format === "table") {
        console.log(formatConfig(config as unknown as Record<string, unknown>));
      } else {
        console.log(formatOutput(config, { format: config.cli.output_format }));
      }
    });

  configCmd
    .command("path")
    .description("Show config file path")
    .action(() => {
      console.log(getConfigPath());
    });

  configCmd
    .command("init")
    .description("Create a default config file")
    .action(() => {
      writeDefaultConfig();
      printSuccess(`Config file created at: ${getConfigPath()}`);
      printInfo("Edit this file to customize your settings.");
    });

  // Default to "show" if no subcommand specified
  configCmd.action(() => {
    const config = getConfig();
    if (config.cli.output_format === "table") {
      console.log(formatConfig(config as unknown as Record<string, unknown>));
    } else {
      console.log(formatOutput(config, { format: config.cli.output_format }));
    }
  });
}
