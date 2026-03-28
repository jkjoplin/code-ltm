import { Command } from "commander";
import Table from "cli-table3";
import chalk from "chalk";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import {
  listBundledTemplates,
  loadBundledTemplate,
  fetchTemplateFromUrl,
  isBundledTemplate,
  type Template,
} from "../../templates/index.js";
import type { AddLearningInput, Scope } from "../../types.js";

export function registerSeedCommand(program: Command): void {
  program
    .command("seed [template]")
    .description("Seed learnings from starter templates")
    .option("-l, --list", "List available bundled templates")
    .option("-u, --url <url>", "Seed from a template URL")
    .option("--dry-run", "Preview what would be seeded without making changes")
    .option("--skip-existing", "Skip if any learnings already exist in database")
    .option("-s, --scope <scope>", "Override template scope (project, cross-project, global)")
    .action(async (template: string | undefined, opts) => {
      try {
        // Handle --list flag
        if (opts.list) {
          displayTemplateList();
          return;
        }

        // Validate: need either template name or --url
        if (!template && !opts.url) {
          printError("Please specify a template name or use --url");
          printInfo("Run 'code-ltm-cli seed --list' to see available templates");
          process.exit(1);
        }

        // Load template
        let loadedTemplate: Template;
        let sourceName: string;

        if (opts.url) {
          const spinner = ora("Fetching template from URL...").start();
          try {
            loadedTemplate = await fetchTemplateFromUrl(opts.url);
            sourceName = opts.url;
            spinner.succeed(`Fetched template: ${loadedTemplate.name}`);
          } catch (error) {
            spinner.fail("Failed to fetch template");
            printError(error instanceof Error ? error.message : String(error));
            process.exit(1);
          }
        } else if (template && isBundledTemplate(template)) {
          try {
            loadedTemplate = loadBundledTemplate(template);
            sourceName = template;
          } catch {
            printError(`Template not found: ${template}`);
            printInfo("Run 'code-ltm-cli seed --list' to see available templates");
            process.exit(1);
          }
        } else {
          printError(`Unknown template: ${template}`);
          printInfo("Run 'code-ltm-cli seed --list' to see available templates");
          process.exit(1);
        }

        // Display template info
        printInfo(`Template: ${loadedTemplate.name}`);
        printInfo(`Description: ${loadedTemplate.description}`);
        printInfo(`Learnings: ${loadedTemplate.learnings.length}`);

        // Validate scope override if provided
        const validScopes: Scope[] = ["project", "cross-project", "global"];
        const targetScope: Scope = opts.scope && validScopes.includes(opts.scope)
          ? opts.scope
          : loadedTemplate.scope;

        if (opts.scope && !validScopes.includes(opts.scope)) {
          printWarning(`Invalid scope '${opts.scope}', using template default: ${loadedTemplate.scope}`);
        }

        printInfo(`Target scope: ${targetScope}`);

        if (opts.dryRun) {
          printWarning("DRY RUN - no changes will be made");
          displayDryRunPreview(loadedTemplate, targetScope);
          return;
        }

        const config = getConfig();
        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Check if learnings already exist
        if (opts.skipExisting) {
          const existing = repo.list({ limit: 1, offset: 0 });
          if (existing.length > 0) {
            printInfo("Learnings already exist in database, skipping seed");
            db.close();
            return;
          }
        }

        // Initialize embedding service
        const embeddingService = new EmbeddingService(config.embeddings);
        await embeddingService.initialize();
        repo.setEmbeddingService(embeddingService);

        // Seed learnings
        const spinner = ora("Seeding learnings...").start();
        let seeded = 0;
        let errors = 0;

        for (const learning of loadedTemplate.learnings) {
          try {
            const input: AddLearningInput = {
              title: learning.title,
              content: learning.content,
              type: learning.type,
              scope: targetScope,
              tags: learning.tags,
              file_references: [],
              related_ids: [],
              confidence: learning.confidence,
              created_by: `seed:${sourceName}`,
            };

            repo.add(input);
            seeded++;
            spinner.text = `Seeded ${seeded} learnings...`;
          } catch (error) {
            errors++;
            console.error(
              `\nFailed to seed "${learning.title}": ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        spinner.succeed("Seeding complete");

        printSuccess(`Seeded: ${seeded} learnings`);
        if (errors > 0) {
          printError(`Errors: ${errors}`);
        }

        db.close();
      } catch (error) {
        printError(
          `Seed failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}

/**
 * Display list of available templates
 */
function displayTemplateList(): void {
  const templates = listBundledTemplates();

  if (templates.length === 0) {
    printInfo("No bundled templates available");
    return;
  }

  console.log(chalk.bold.white("\nAvailable Templates"));
  console.log(chalk.gray("─".repeat(60)));

  const table = new Table({
    head: [
      chalk.cyan("ID"),
      chalk.cyan("Name"),
      chalk.cyan("Description"),
      chalk.cyan("Learnings"),
    ],
    style: { head: [], border: [] },
    colWidths: [15, 25, 35, 12],
    wordWrap: true,
  });

  for (const t of templates) {
    table.push([t.id, t.name, t.description, String(t.learningCount)]);
  }

  console.log(table.toString());
  console.log("");
  printInfo("Usage: code-ltm-cli seed <template-id>");
  printInfo("Example: code-ltm-cli seed generic");
}

/**
 * Display dry run preview
 */
function displayDryRunPreview(template: Template, scope: Scope): void {
  console.log(chalk.bold.white("\nLearnings that would be seeded:"));
  console.log(chalk.gray("─".repeat(60)));

  const table = new Table({
    head: [
      chalk.cyan("Title"),
      chalk.cyan("Type"),
      chalk.cyan("Tags"),
    ],
    style: { head: [], border: [] },
    colWidths: [40, 15, 25],
    wordWrap: true,
  });

  for (const learning of template.learnings) {
    table.push([
      learning.title,
      formatType(learning.type),
      learning.tags.join(", ") || chalk.gray("-"),
    ]);
  }

  console.log(table.toString());
  console.log("");
  printInfo(`All learnings would be created with scope: ${scope}`);
}

/**
 * Format type with color
 */
function formatType(type: string): string {
  const colors: Record<string, (s: string) => string> = {
    gotcha: chalk.red,
    pattern: chalk.blue,
    investigation: chalk.yellow,
    documentation: chalk.green,
    tip: chalk.magenta,
  };
  return (colors[type] ?? chalk.white)(type);
}
