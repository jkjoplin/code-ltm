import { Command } from "commander";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { printSuccess, printError, printInfo } from "../output.js";

export function registerReembedCommand(program: Command): void {
  program
    .command("reembed")
    .description("Regenerate embeddings for learnings")
    .option("--force", "Regenerate all embeddings, not just missing ones")
    .option("-b, --batch-size <n>", "Batch size for processing", "10")
    .action(async (opts) => {
      try {
        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Initialize embedding service
        const initSpinner = ora("Initializing embedding service...").start();
        const embeddingService = new EmbeddingService(config.embeddings);
        await embeddingService.initialize();

        if (!embeddingService.isAvailable()) {
          initSpinner.fail("No embedding provider available");
          process.exit(1);
        }

        initSpinner.succeed(
          `Using embedding provider: ${embeddingService.getActiveProvider()}`
        );

        repo.setEmbeddingService(embeddingService);

        const batchSize = parseInt(opts.batchSize, 10) || 10;
        const force = opts.force ?? false;

        // Get stats
        const stats = repo.getEmbeddingStats();
        printInfo(`Total learnings: ${stats.total}`);
        printInfo(`Already embedded: ${stats.embedded}`);

        let processed = 0;
        let failed = 0;
        let offset = 0;

        const spinner = ora("Processing embeddings...").start();

        while (true) {
          let learnings: Array<{ id: string; title: string; content: string }>;

          if (force) {
            // Force mode: re-embed all
            learnings = repo.getAllLearningsForEmbedding(batchSize, offset);
          } else {
            // Normal mode: only embed missing
            learnings = repo.getLearningsWithoutEmbeddings(batchSize);
          }

          if (learnings.length === 0) {
            break;
          }

          for (const learning of learnings) {
            try {
              spinner.text = `Processing: ${learning.title.slice(0, 40)}...`;
              const success = await repo.generateEmbedding(
                learning.id,
                learning.title,
                learning.content
              );
              if (success) {
                processed++;
              } else {
                failed++;
              }
            } catch (error) {
              failed++;
              console.error(
                `\nFailed to embed ${learning.id}: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }

          if (force) {
            offset += batchSize;
            if (offset >= stats.total) {
              break;
            }
          }

          spinner.text = `Processed ${processed} embeddings...`;
        }

        spinner.succeed(`Embedding complete`);

        printSuccess(`Processed: ${processed}`);
        if (failed > 0) {
          printError(`Failed: ${failed}`);
        }

        // Show updated stats
        const newStats = repo.getEmbeddingStats();
        printInfo(`Embeddings: ${newStats.embedded}/${newStats.total}`);

        db.close();
      } catch (error) {
        printError(
          `Reembed failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
