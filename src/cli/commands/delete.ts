import { Command } from "commander";
import inquirer from "inquirer";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { printSuccess, printError, printWarning } from "../output.js";

export function registerDeleteCommand(program: Command): void {
  program
    .command("delete <id>")
    .description("Delete a learning")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id, opts) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Find the learning (support partial ID)
        let learning = repo.get(id);
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

        // Confirm deletion unless --yes flag
        if (!opts.yes) {
          printWarning(`About to delete: "${learning.title}" (${learning.id})`);
          const { confirm } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirm",
              message: "Are you sure you want to delete this learning?",
              default: false,
            },
          ]);

          if (!confirm) {
            console.log("Cancelled.");
            process.exit(0);
          }
        }

        const deleted = repo.delete(learning.id, "cli");

        if (deleted) {
          printSuccess(`Deleted learning: ${learning.id}`);
        } else {
          printError("Delete failed");
          process.exit(1);
        }

        db.close();
      } catch (error) {
        printError(
          `Failed to delete learning: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
