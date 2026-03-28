import { Command } from "commander";
import fs from "node:fs";
import inquirer from "inquirer";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { EmbeddingService } from "../../embeddings/index.js";
import { getConfig } from "../../config/index.js";
import { formatOutput, printSuccess, printError } from "../output.js";
import type { LearningType, Scope, Confidence } from "../../types.js";

const TYPES: LearningType[] = [
  "gotcha",
  "pattern",
  "tip",
  "documentation",
  "investigation",
];
const SCOPES: Scope[] = ["project", "cross-project", "global"];
const CONFIDENCES: Confidence[] = ["low", "medium", "high"];

export function registerUpdateCommand(program: Command): void {
  program
    .command("update <id>")
    .description("Update an existing learning")
    .option("--title <title>", "New title")
    .option("--content <text>", "New content")
    .option("--file <path>", "Read new content from file")
    .option("-t, --type <type>", "New type")
    .option("-s, --scope <scope>", "New scope")
    .option("--tags <tags>", "New tags (comma-separated, replaces existing)")
    .option("-c, --confidence <level>", "New confidence level")
    .option("-p, --project <path>", "New project path (use 'null' to clear)")
    .option("-i, --interactive", "Interactive mode")
    .action(async (id, opts) => {
      try {
        const config = getConfig();
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

        let title = opts.title;
        let content = opts.content;
        let type = opts.type as LearningType | undefined;
        let scope = opts.scope as Scope | undefined;
        let tags = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : undefined;
        let confidence = opts.confidence as Confidence | undefined;
        const projectPath = opts.project;

        // Read content from file if specified
        if (opts.file) {
          if (!fs.existsSync(opts.file)) {
            printError(`File not found: ${opts.file}`);
            process.exit(1);
          }
          content = fs.readFileSync(opts.file, "utf-8");
        }

        // Interactive mode
        if (opts.interactive) {
          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "title",
              message: "Title:",
              default: learning.title,
            },
            {
              type: "editor",
              name: "content",
              message: "Content (opens editor):",
              default: learning.content,
            },
            {
              type: "list",
              name: "type",
              message: "Type:",
              choices: TYPES,
              default: learning.type,
            },
            {
              type: "list",
              name: "scope",
              message: "Scope:",
              choices: SCOPES,
              default: learning.scope,
            },
            {
              type: "input",
              name: "tags",
              message: "Tags (comma-separated):",
              default: learning.tags.join(", "),
            },
            {
              type: "list",
              name: "confidence",
              message: "Confidence:",
              choices: CONFIDENCES,
              default: learning.confidence,
            },
          ]);

          title = answers.title !== learning.title ? answers.title : undefined;
          content =
            answers.content !== learning.content ? answers.content : undefined;
          type = answers.type !== learning.type ? answers.type : undefined;
          scope = answers.scope !== learning.scope ? answers.scope : undefined;
          tags = answers.tags
            ? answers.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : undefined;
          confidence =
            answers.confidence !== learning.confidence
              ? answers.confidence
              : undefined;
        }

        // Check if there's anything to update
        if (
          !title &&
          !content &&
          !type &&
          !scope &&
          !tags &&
          !confidence &&
          !projectPath
        ) {
          printError("No updates specified. Use flags or --interactive");
          process.exit(1);
        }

        // Initialize embedding service for re-embedding if content changes
        const spinner = ora("Initializing...").start();
        const embeddingService = new EmbeddingService(config.embeddings);
        await embeddingService.initialize();
        repo.setEmbeddingService(embeddingService);
        spinner.succeed("Initialized");

        const updateSpinner = ora("Updating learning...").start();

        // Handle "null" project path to clear it
        const projectPathUpdate =
          projectPath === "null" ? null : projectPath ?? undefined;

        const updated = repo.update(
          {
            id: learning.id,
            title,
            content,
            type,
            scope,
            tags,
            confidence,
            project_path: projectPathUpdate,
          },
          "cli"
        );

        if (!updated) {
          updateSpinner.fail("Update failed");
          process.exit(1);
        }

        // Wait for embedding if content changed
        if ((title || content) && embeddingService.isAvailable()) {
          updateSpinner.text = "Updating embedding...";
          await repo.generateEmbedding(updated.id, updated.title, updated.content);
        }

        updateSpinner.succeed("Learning updated");

        printSuccess(`Updated learning: ${updated.id}`);
        console.log(formatOutput(updated, { format: config.cli.output_format }));

        db.close();
      } catch (error) {
        printError(
          `Failed to update learning: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
