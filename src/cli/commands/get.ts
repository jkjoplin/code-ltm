import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { getConfig } from "../../config/index.js";
import { formatOutput, printError } from "../output.js";

export function registerGetCommand(program: Command): void {
  program
    .command("get <id>")
    .description("Get a single learning by ID")
    .action((id) => {
      try {
        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Support partial ID matching
        let learning = repo.get(id);

        // If not found, try searching for partial ID match
        if (!learning && id.length < 36) {
          const all = repo.list({ limit: 1000, offset: 0 });
          const match = all.find((l) => l.id.startsWith(id));
          if (match) {
            learning = repo.get(match.id);
          }
        }

        if (!learning) {
          printError(`Learning not found: ${id}`);
          process.exit(1);
        }

        console.log(formatOutput(learning, { format: config.cli.output_format }));

        db.close();
      } catch (error) {
        printError(
          `Failed to get learning: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
