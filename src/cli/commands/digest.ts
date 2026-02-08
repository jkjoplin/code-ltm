import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { createDatabase } from "../../db/schema.js";
import { LearningRepository } from "../../db/repository.js";
import { generateDigest } from "../../digest/index.js";
import { printSuccess, printError, printInfo } from "../output.js";
import type { Scope, LearningType, Confidence } from "../../types.js";
import type { DigestFormat } from "../../digest/types.js";

export function registerDigestCommand(program: Command): void {
  program
    .command("digest")
    .description("Generate a compressed digest of learnings for passive context (e.g. AGENTS.md)")
    .option("-s, --scope <scope>", "Filter by scope")
    .option("-t, --type <type>", "Filter by type")
    .option("--tags <tags>", "Filter by tags (comma-separated)")
    .option("-p, --project <path>", "Filter by project path")
    .option("--min-confidence <level>", "Minimum confidence: low, medium, high", "medium")
    .option("--require-tag <tag>", "Only include learnings with this tag")
    .option("--format <fmt>", "Output format: markdown, index, json", "markdown")
    .option("--max-chars <n>", "Character budget", "8192")
    .option("--max-content <n>", "Per-learning content limit", "500")
    .option("--no-group", "Don't group by type")
    .option("--no-ids", "Don't include learning IDs")
    .option("--no-metadata", "Don't include generation metadata")
    .option("-o, --output <path>", "Write to file instead of stdout")
    .action((opts) => {
      try {
        const db = createDatabase();
        const repo = new LearningRepository(db);

        const tags = opts.tags
          ? opts.tags.split(",").map((t: string) => t.trim())
          : undefined;

        const spinner = ora("Generating digest...").start();

        const result = generateDigest(repo, {
          scope: opts.scope as Scope | undefined,
          type: opts.type as LearningType | undefined,
          tags,
          project_path: opts.project ? path.resolve(opts.project) : undefined,
          min_confidence: opts.minConfidence as Confidence,
          require_tag: opts.requireTag,
          format: opts.format as DigestFormat,
          max_chars: parseInt(opts.maxChars, 10),
          max_content_length: parseInt(opts.maxContent, 10),
          group_by_type: opts.group !== false,
          include_ids: opts.ids !== false,
          include_metadata: opts.metadata !== false,
        });

        spinner.succeed(
          `Digest: ${result.stats.total_included}/${result.stats.total_matched} learnings, ${result.stats.character_count} chars`
        );

        if (opts.output) {
          fs.writeFileSync(opts.output, result.output, "utf-8");
          printSuccess(`Written to: ${opts.output}`);
          printInfo(
            `${result.stats.total_included} learnings included, ${result.stats.total_omitted} omitted`
          );
        } else {
          console.log(result.output);
        }

        db.close();
      } catch (error) {
        printError(
          `Digest failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
