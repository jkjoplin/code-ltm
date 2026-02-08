import { Command } from "commander";
import fs from "node:fs";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import type { Learning } from "../../types.js";

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
        const idMap = new Map<string, string>();
        const relationSyncIds = new Set<string>();

        const spinner = ora("Importing...").start();

        for (const learning of data.learnings) {
          try {
            // Check if exists
            const existing = repo.get(learning.id);
            if (existing) {
              if (opts.skipExisting) {
                skipped++;
                idMap.set(learning.id, existing.id);
                continue;
              }
              // Update existing if not skipping
              if (!opts.dryRun) {
                const result = repo.upsert(
                  {
                    id: learning.id,
                    title: learning.title,
                    content: learning.content,
                    type: learning.type,
                    scope: learning.scope,
                    tags: learning.tags,
                    file_references: learning.file_references,
                    related_ids: [],
                    confidence: learning.confidence,
                    project_path: learning.project_path ?? null,
                    created_by: learning.created_by ?? "cli-import",
                    created_at: learning.created_at,
                    updated_at: learning.updated_at,
                    version: learning.version,
                    deprecated: learning.deprecated ?? false,
                    deprecated_reason: learning.deprecated_reason ?? null,
                    deprecated_at: learning.deprecated_at ?? null,
                    applies_to: learning.applies_to ?? null,
                    if_exists: "update",
                  },
                  "cli-import"
                );
                idMap.set(learning.id, result.learning.id);
                relationSyncIds.add(learning.id);
              }
              imported++;
            } else {
              // Create new
              if (!opts.dryRun) {
                const result = repo.upsert({
                  id: learning.id,
                  title: learning.title,
                  content: learning.content,
                  type: learning.type,
                  scope: learning.scope,
                  tags: learning.tags,
                  file_references: learning.file_references,
                  related_ids: [], // Skip related_ids on first pass to avoid missing refs
                  confidence: learning.confidence,
                  project_path: learning.project_path ?? null,
                  created_by: learning.created_by ?? "cli-import",
                  created_at: learning.created_at,
                  updated_at: learning.updated_at,
                  version: learning.version,
                  deprecated: learning.deprecated ?? false,
                  deprecated_reason: learning.deprecated_reason ?? null,
                  deprecated_at: learning.deprecated_at ?? null,
                  applies_to: learning.applies_to ?? null,
                  if_exists: "error",
                });
                idMap.set(learning.id, result.learning.id);
                relationSyncIds.add(learning.id);
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
            if (!relationSyncIds.has(learning.id)) continue;
            const sourceId = idMap.get(learning.id) ?? learning.id;
            const source = repo.get(sourceId);
            if (!source) continue;

            if (learning.related_ids && learning.related_ids.length > 0) {
              const mappedRelated = learning.related_ids
                .map((relatedId) => idMap.get(relatedId))
                .filter((relatedId): relatedId is string => !!relatedId);

              repo.upsert(
                {
                  id: source.id,
                  title: source.title,
                  content: source.content,
                  type: source.type,
                  scope: source.scope,
                  project_path: source.project_path ?? null,
                  tags: source.tags,
                  file_references: source.file_references,
                  related_ids: mappedRelated,
                  confidence: source.confidence,
                  created_by: source.created_by,
                  created_at: source.created_at,
                  updated_at: source.updated_at,
                  version: source.version,
                  deprecated: source.deprecated,
                  deprecated_reason: source.deprecated_reason,
                  deprecated_at: source.deprecated_at,
                  applies_to: source.applies_to,
                  if_exists: "update",
                },
                "cli-import"
              );
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
