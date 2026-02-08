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
  "suggestion",
  "rule",
];
const SCOPES: Scope[] = ["project", "cross-project", "global"];
const CONFIDENCES: Confidence[] = ["low", "medium", "high"];

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .description("Add a new learning")
    .option("--title <title>", "Learning title")
    .option("--content <text>", "Learning content")
    .option("--file <path>", "Read content from file")
    .option("-t, --type <type>", "Type: gotcha, pattern, tip, documentation, investigation, suggestion")
    .option("-s, --scope <scope>", "Scope: project, cross-project, global")
    .option("--tags <tags>", "Tags (comma-separated)")
    .option("-c, --confidence <level>", "Confidence: low, medium, high", "medium")
    .option("-p, --project <path>", "Project path")
    .option("-i, --interactive", "Interactive mode (prompts for each field)")
    .action(async (opts) => {
      try {
        const config = getConfig();

        let title = opts.title;
        let content = opts.content;
        let type = opts.type as LearningType | undefined;
        let scope = opts.scope as Scope | undefined;
        let tags: string[] = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : [];
        let confidence = opts.confidence as Confidence;
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
        if (opts.interactive || (!title && !content)) {
          const answers = await inquirer.prompt([
            {
              type: "input",
              name: "title",
              message: "Title:",
              default: title,
              validate: (input: string) =>
                input.length > 0 || "Title is required",
            },
            {
              type: "editor",
              name: "content",
              message: "Content (opens editor):",
              default: content,
              validate: (input: string) =>
                input.length > 0 || "Content is required",
            },
            {
              type: "list",
              name: "type",
              message: "Type:",
              choices: TYPES,
              default: type ?? "tip",
            },
            {
              type: "list",
              name: "scope",
              message: "Scope:",
              choices: SCOPES,
              default: scope ?? "project",
            },
            {
              type: "input",
              name: "tags",
              message: "Tags (comma-separated):",
              default: tags.join(", "),
            },
            {
              type: "list",
              name: "confidence",
              message: "Confidence:",
              choices: CONFIDENCES,
              default: confidence,
            },
          ]);

          title = answers.title;
          content = answers.content;
          type = answers.type;
          scope = answers.scope;
          tags = answers.tags
            ? answers.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [];
          confidence = answers.confidence;
        }

        // Validate required fields
        if (!title) {
          printError("Title is required. Use --title or --interactive");
          process.exit(1);
        }
        if (!content) {
          printError("Content is required. Use --content, --file, or --interactive");
          process.exit(1);
        }
        if (!type) {
          printError("Type is required. Use --type or --interactive");
          process.exit(1);
        }
        if (!scope) {
          printError("Scope is required. Use --scope or --interactive");
          process.exit(1);
        }

        const db = createDatabase();
        const repo = new LearningRepository(db);

        // Initialize embedding service for automatic embedding
        const spinner = ora("Initializing...").start();
        const embeddingService = new EmbeddingService(config.embeddings);
        await embeddingService.initialize();
        repo.setEmbeddingService(embeddingService);
        spinner.succeed("Initialized");

        const addSpinner = ora("Adding learning...").start();

        const learning = repo.add({
          title,
          content,
          type,
          scope,
          tags,
          confidence,
          project_path: projectPath,
          file_references: [],
          related_ids: [],
          created_by: "cli",
        });

        addSpinner.text = "Generating embedding...";

        // Wait for embedding to complete (the add method fires it async, so we regenerate synchronously)
        if (embeddingService.isAvailable()) {
          await repo.generateEmbedding(learning.id, learning.title, learning.content);
        }

        addSpinner.succeed("Learning added");

        printSuccess(`Created learning: ${learning.id}`);
        console.log(formatOutput(learning, { format: config.cli.output_format }));

        db.close();
      } catch (error) {
        printError(
          `Failed to add learning: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
