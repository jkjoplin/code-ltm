import { Command } from "commander";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig, getDbPath } from "../../config/index.js";
import { formatOutput, formatStats, printError } from "../output.js";
import type { LearningType, Scope } from "../../types.js";

export function registerStatsCommand(program: Command): void {
  program
    .command("stats")
    .description("Show database statistics")
    .action(async () => {
      try {
        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);
        const embeddingService = new EmbeddingService(config.embeddings);
        await embeddingService.initialize();

        // Get embedding stats
        const embeddingStats = repo.getEmbeddingStats();

        // Get counts by type and scope
        const byType: Record<string, number> = {};
        const byScope: Record<string, number> = {};

        const types: LearningType[] = [
          "gotcha",
          "pattern",
          "investigation",
          "documentation",
          "tip",
        ];
        const scopes: Scope[] = ["project", "cross-project", "global"];

        for (const type of types) {
          const results = repo.list({ type, limit: 1000, offset: 0 });
          byType[type] = results.length;
        }

        for (const scope of scopes) {
          const results = repo.list({ scope, limit: 1000, offset: 0 });
          byScope[scope] = results.length;
        }

        const stats = {
          total: embeddingStats.total,
          embedded: embeddingStats.embedded,
          byType,
          byScope,
          dbPath: getDbPath(),
          embeddingProvider: embeddingService.getActiveProvider(),
        };

        if (config.cli.output_format === "table") {
          console.log(formatStats(stats));
        } else {
          console.log(formatOutput(stats, { format: config.cli.output_format }));
        }

        db.close();
      } catch (error) {
        printError(
          `Failed to get stats: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
