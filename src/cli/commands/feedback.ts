import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import type { FeedbackOutcome, FeedbackSource } from "../../types.js";
import { printError, printSuccess } from "../output.js";

export function registerFeedbackCommand(program: Command): void {
  program
    .command("feedback <id>")
    .description("Record usefulness feedback for a learning")
    .requiredOption("--outcome <outcome>", "used, helpful, dismissed")
    .option("--source <source>", "agent, user, auto", "agent")
    .option("--context <text>", "Optional context text")
    .action((id, opts) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);
        const metrics = repo.recordFeedback(
          String(id),
          opts.outcome as FeedbackOutcome,
          opts.source as FeedbackSource,
          opts.context
        );

        if (!metrics) {
          printError(`Learning not found: ${id}`);
          process.exit(1);
        }

        printSuccess(`Feedback recorded for ${id}`);
        console.log(JSON.stringify(metrics, null, 2));
        db.close();
      } catch (error) {
        printError(
          `Feedback failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
