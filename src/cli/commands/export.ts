import { Command } from "commander";
import fs from "node:fs";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { printSuccess, printError, printInfo } from "../output.js";
import type { Scope, LearningType, Learning } from "../../types.js";

interface ExportData {
  version: string;
  exported_at: string;
  learnings: Learning[];
}

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export learnings to JSON")
    .option("-o, --output <path>", "Output file path (default: stdout)")
    .option("-s, --scope <scope>", "Filter by scope")
    .option("-t, --type <type>", "Filter by type")
    .option("--tags <tags>", "Filter by tags (comma-separated)")
    .action((opts) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);

        const tags = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : undefined;

        const spinner = ora("Fetching learnings...").start();

        // Fetch all matching learnings
        const summaries = repo.list({
          scope: opts.scope as Scope | undefined,
          type: opts.type as LearningType | undefined,
          tags,
          limit: 10000, // High limit for export
          offset: 0,
        });

        // Fetch full learnings
        const learnings: Learning[] = [];
        for (const summary of summaries) {
          const learning = repo.get(summary.id);
          if (learning) {
            learnings.push(learning);
          }
        }

        spinner.succeed(`Found ${learnings.length} learnings`);

        const exportData: ExportData = {
          version: "1.0",
          exported_at: new Date().toISOString(),
          learnings,
        };

        const json = JSON.stringify(exportData, null, 2);

        if (opts.output) {
          fs.writeFileSync(opts.output, json, "utf-8");
          printSuccess(`Exported to: ${opts.output}`);
          printInfo(`${learnings.length} learnings exported`);
        } else {
          console.log(json);
        }

        db.close();
      } catch (error) {
        printError(
          `Export failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
