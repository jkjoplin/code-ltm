import { Command } from "commander";
import fs from "node:fs";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import type { Learning, AddLearningInput } from "../../types.js";

interface ExportData {
  version: string;
  exported_at: string;
  learnings: Learning[];
}

export function registerImportCommand(program: Command): void {
  program
    .command("import <file>")
    .description("Import learnings from JSON file")
    .option("--skip-existing", "Skip learnings with IDs that already exist")
    .option("--dry-run", "Show what would be imported without making changes")
    .action(async (file, opts) => {
      try {
        const config = getConfig();

        if (!fs.existsSync(file)) {
          printError(`File not found: ${file}`);
          process.exit(1);
        }

        const content = fs.readFileSync(file, "utf-8");
        let data: ExportData;

        try {
          data = JSON.parse(content) as ExportData;
        } catch {
          printError("Invalid JSON file");
          process.exit(1);
        }

        if (!data.learnings || !Array.isArray(data.learnings)) {
          printError("Invalid export format: missing 'learnings' array");
          process.exit(1);
        }

        printInfo(`File version: ${data.version ?? "unknown"}`);
        printInfo(`Exported at: ${data.exported_at ?? "unknown"}`);
        printInfo(`Learnings in file: ${data.learnings.length}`);

        if (opts.dryRun) {
          printWarning("DRY RUN - no changes will be made");
        }

        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Initialize embedding service
        if (!opts.dryRun) {
          const embeddingService = new EmbeddingService(config.embeddings);
          await embeddingService.initialize();
          repo.setEmbeddingService(embeddingService);
        }

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        const spinner = ora("Importing...").start();

        for (const learning of data.learnings) {
          try {
            // Check if exists
            const existing = repo.get(learning.id);
            if (existing) {
              if (opts.skipExisting) {
                skipped++;
                continue;
              }
              // Update existing if not skipping
              if (!opts.dryRun) {
                repo.update(
                  {
                    id: learning.id,
                    title: learning.title,
                    content: learning.content,
                    type: learning.type,
                    scope: learning.scope,
                    tags: learning.tags,
                    file_references: learning.file_references,
                    related_ids: learning.related_ids,
                    confidence: learning.confidence,
                    project_path: learning.project_path ?? null,
                  },
                  "cli-import"
                );
              }
              imported++;
            } else {
              // Create new
              if (!opts.dryRun) {
                const input: AddLearningInput = {
                  title: learning.title,
                  content: learning.content,
                  type: learning.type,
                  scope: learning.scope,
                  tags: learning.tags,
                  file_references: learning.file_references,
                  related_ids: [], // Skip related_ids on first pass to avoid missing refs
                  confidence: learning.confidence,
                  project_path: learning.project_path,
                  created_by: learning.created_by ?? "cli-import",
                };
                repo.add(input);
              }
              imported++;
            }

            spinner.text = `Imported ${imported} learnings...`;
          } catch (error) {
            errors++;
            console.error(
              `\nFailed to import ${learning.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        // Second pass: restore relationships
        if (!opts.dryRun && data.learnings.length > 0) {
          spinner.text = "Restoring relationships...";
          for (const learning of data.learnings) {
            if (learning.related_ids && learning.related_ids.length > 0) {
              for (const relatedId of learning.related_ids) {
                try {
                  repo.linkLearnings(learning.id, relatedId);
                } catch {
                  // Ignore link errors (target may not exist)
                }
              }
            }
          }
        }

        spinner.succeed("Import complete");

        printSuccess(`Imported: ${imported}`);
        if (skipped > 0) {
          printInfo(`Skipped (existing): ${skipped}`);
        }
        if (errors > 0) {
          printError(`Errors: ${errors}`);
        }

        db.close();
      } catch (error) {
        printError(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
