import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { printSuccess, printError } from "../output.js";

export function registerLinkCommand(program: Command): void {
  program
    .command("link <id1> <id2>")
    .description("Link two learnings as related")
    .action((id1, id2) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Resolve partial IDs
        const resolveId = (partialId: string): string | null => {
          const learning = repo.get(partialId);
          if (learning) return learning.id;

          if (partialId.length < 36) {
            const all = repo.list({ limit: 1000, offset: 0 });
            const match = all.find((l) => l.id.startsWith(partialId));
            return match?.id ?? null;
          }
          return null;
        };

        const fullId1 = resolveId(id1);
        const fullId2 = resolveId(id2);

        if (!fullId1) {
          printError(`Learning not found: ${id1}`);
          process.exit(1);
        }

        if (!fullId2) {
          printError(`Learning not found: ${id2}`);
          process.exit(1);
        }

        if (fullId1 === fullId2) {
          printError("Cannot link a learning to itself");
          process.exit(1);
        }

        const linked = repo.linkLearnings(fullId1, fullId2);

        if (linked) {
          printSuccess(
            `Linked learnings:\n  ${fullId1.slice(0, 8)} <-> ${fullId2.slice(0, 8)}`
          );
        } else {
          printError("Failed to link learnings");
          process.exit(1);
        }

        db.close();
      } catch (error) {
        printError(
          `Failed to link learnings: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
