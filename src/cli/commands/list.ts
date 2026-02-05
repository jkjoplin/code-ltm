import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { getConfig } from "../../config/index.js";
import { formatOutput, printError } from "../output.js";
import type { Scope, LearningType } from "../../types.js";

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List learnings with filters")
    .option("-s, --scope <scope>", "Filter by scope: project, cross-project, global")
    .option(
      "-t, --type <type>",
      "Filter by type: gotcha, pattern, investigation, documentation, tip"
    )
    .option("--tags <tags>", "Filter by tags (comma-separated)")
    .option("-l, --limit <n>", "Max results", "20")
    .option("-o, --offset <n>", "Skip first N results", "0")
    .option("-p, --project <path>", "Filter by project path")
    .action((opts) => {
      try {
        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);

        const tags = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : undefined;

        const results = repo.list({
          scope: (opts.scope ?? config.cli.default_scope) as Scope | undefined,
          type: opts.type as LearningType | undefined,
          tags,
          project_path: opts.project,
          limit: parseInt(opts.limit, 10) || config.cli.default_limit,
          offset: parseInt(opts.offset, 10) || 0,
        });

        console.log(formatOutput(results, { format: config.cli.output_format }));

        db.close();
      } catch (error) {
        printError(
          `Failed to list learnings: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
