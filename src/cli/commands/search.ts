import { Command } from "commander";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { formatOutput, printError, printWarning } from "../output.js";
import type { Scope, LearningType, SearchMode } from "../../types.js";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search learnings (keyword, semantic, or hybrid)")
    .option(
      "-m, --mode <mode>",
      "Search mode: keyword, semantic, hybrid",
      "hybrid"
    )
    .option(
      "-w, --weight <n>",
      "Semantic weight 0-1 for hybrid mode",
      "0.5"
    )
    .option("-s, --scope <scope>", "Filter by scope")
    .option("-t, --type <type>", "Filter by type")
    .option("--tags <tags>", "Filter by tags (comma-separated)")
    .option("-l, --limit <n>", "Max results", "20")
    .option("-p, --project <path>", "Filter by project path")
    .option("--full", "Include full content in results")
    .action(async (query, opts) => {
      try {
        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);

        const mode = opts.mode as SearchMode;
        const needsEmbedding = mode === "semantic" || mode === "hybrid";

        let spinner;
        if (needsEmbedding) {
          spinner = ora("Initializing embedding service...").start();
          const embeddingService = new EmbeddingService(config.embeddings);
          await embeddingService.initialize();
          repo.setEmbeddingService(embeddingService);

          if (!embeddingService.isAvailable() && mode === "semantic") {
            spinner.fail("Semantic search unavailable: no embedding provider");
            printWarning("Falling back to keyword search");
          } else if (embeddingService.isAvailable()) {
            spinner.succeed(
              `Using embedding provider: ${embeddingService.getActiveProvider()}`
            );
          }
        }

        const tags = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : undefined;

        const searchSpinner = ora("Searching...").start();
        const parsedWeight = Number.parseFloat(opts.weight);
        const semanticWeight =
          Number.isNaN(parsedWeight)
            ? 0.5
            : Math.max(0, Math.min(1, parsedWeight));

        const results = await repo.hybridSearch({
          query,
          scope: (opts.scope ?? config.cli.default_scope) as Scope | undefined,
          type: opts.type as LearningType | undefined,
          tags,
          project_path: opts.project,
          limit: parseInt(opts.limit, 10) || config.cli.default_limit,
          mode,
          semantic_weight: semanticWeight,
        });

        if (results.length > 0) {
          repo.recordAccess(results.map((r) => r.id));
        }

        searchSpinner.succeed(`Found ${results.length} result(s)`);

        // If --full flag, fetch full learnings
        if (opts.full) {
          const fullResults = results.map((summary) => repo.get(summary.id));
          console.log(
            formatOutput(fullResults, { format: config.cli.output_format })
          );
        } else {
          console.log(formatOutput(results, { format: config.cli.output_format }));
        }

        db.close();
      } catch (error) {
        printError(
          `Search failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
