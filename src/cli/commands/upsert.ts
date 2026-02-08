import { Command } from "commander";
import fs from "node:fs";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { getConfig } from "../../config/index.js";
import { EmbeddingService } from "../../embeddings/index.js";
import type {
  LearningType,
  Scope,
  Confidence,
  UpsertIfExists,
} from "../../types.js";
import { formatOutput, printError, printSuccess } from "../output.js";

export function registerUpsertCommand(program: Command): void {
  program
    .command("upsert")
    .description("Upsert a learning with optional explicit ID and metadata")
    .requiredOption("--title <title>", "Learning title")
    .requiredOption("--content <content>", "Learning content")
    .option("--file <path>", "Read content from file")
    .requiredOption("--type <type>", "Type")
    .requiredOption("--scope <scope>", "Scope")
    .option("--id <uuid>", "Explicit learning id")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--confidence <confidence>", "low, medium, high", "medium")
    .option("--project <path>", "Project path")
    .option("--created-by <source>", "Created by", "cli-upsert")
    .option("--if-exists <mode>", "skip, update, error", "update")
    .action(async (opts) => {
      try {
        const config = getConfig();
        let content = opts.content as string;
        if (opts.file) {
          if (!fs.existsSync(opts.file)) {
            printError(`File not found: ${opts.file}`);
            process.exit(1);
          }
          content = fs.readFileSync(opts.file, "utf8");
        }

        const db = createDatabase();
        const repo = new LearningRepository(db);
        const spinner = ora("Initializing embedding service...").start();
        const embedding = new EmbeddingService(config.embeddings);
        await embedding.initialize();
        repo.setEmbeddingService(embedding);
        spinner.stop();

        const tags = opts.tags
          ? String(opts.tags)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [];

        const result = repo.upsert(
          {
            id: opts.id,
            title: String(opts.title),
            content,
            type: opts.type as LearningType,
            scope: opts.scope as Scope,
            project_path: opts.project ?? null,
            tags,
            file_references: [],
            related_ids: [],
            confidence: opts.confidence as Confidence,
            created_by: String(opts.createdBy),
            if_exists: opts.ifExists as UpsertIfExists,
          },
          "cli-upsert"
        );

        printSuccess(
          result.created
            ? `Created learning ${result.learning.id}`
            : result.skipped
              ? `Skipped existing learning ${result.learning.id}`
              : `Updated learning ${result.learning.id}`
        );
        console.log(formatOutput(result.learning, { format: config.cli.output_format }));
        db.close();
      } catch (error) {
        printError(
          `Upsert failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
