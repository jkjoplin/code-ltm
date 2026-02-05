import Table from "cli-table3";
import chalk from "chalk";
import yaml from "yaml";
import type { OutputFormat } from "../config/index.js";
import type { Learning, LearningSummary } from "../types.js";

export interface OutputOptions {
  format: OutputFormat;
  full?: boolean; // Include full content for learnings
}

/**
 * Format data based on output format preference
 */
export function formatOutput(
  data: unknown,
  options: OutputOptions
): string {
  switch (options.format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "yaml":
      return yaml.stringify(data);
    case "table":
    default:
      // For table format, we need to handle different data types
      if (Array.isArray(data)) {
        return formatArrayAsTable(data);
      }
      return formatObjectAsTable(data);
  }
}

/**
 * Format an array of objects as a table
 */
function formatArrayAsTable(data: unknown[]): string {
  if (data.length === 0) {
    return chalk.gray("No results found.");
  }

  // Detect if these are LearningSummary objects
  const first = data[0] as Record<string, unknown>;
  if (first && "id" in first && "title" in first && "type" in first) {
    return formatLearningsTable(data as LearningSummary[]);
  }

  // Generic array table
  const keys = Object.keys(first);
  const table = new Table({
    head: keys.map((k) => chalk.cyan(k)),
    style: { head: [], border: [] },
  });

  for (const item of data) {
    const row = keys.map((k) => String((item as Record<string, unknown>)[k] ?? ""));
    table.push(row);
  }

  return table.toString();
}

/**
 * Format learning summaries as a table
 */
function formatLearningsTable(learnings: LearningSummary[]): string {
  const table = new Table({
    head: [
      chalk.cyan("ID"),
      chalk.cyan("Title"),
      chalk.cyan("Type"),
      chalk.cyan("Scope"),
      chalk.cyan("Tags"),
      chalk.cyan("Confidence"),
    ],
    style: { head: [], border: [] },
    colWidths: [10, 40, 15, 15, 20, 12],
    wordWrap: true,
  });

  for (const l of learnings) {
    table.push([
      l.id.slice(0, 8),
      l.title,
      formatType(l.type),
      formatScope(l.scope),
      l.tags.join(", ") || chalk.gray("-"),
      formatConfidence(l.confidence),
    ]);
  }

  return table.toString();
}

/**
 * Format an object as a vertical key-value table
 */
function formatObjectAsTable(data: unknown): string {
  if (data === null || data === undefined) {
    return chalk.gray("No data.");
  }

  const obj = data as Record<string, unknown>;

  // Check if this is a full Learning object
  if ("id" in obj && "title" in obj && "content" in obj) {
    return formatLearningDetail(obj as Learning);
  }

  // Generic object table
  const table = new Table({
    style: { head: [], border: [] },
  });

  for (const [key, value] of Object.entries(obj)) {
    let displayValue: string;
    if (Array.isArray(value)) {
      displayValue = value.length > 0 ? value.join(", ") : chalk.gray("-");
    } else if (typeof value === "object" && value !== null) {
      displayValue = JSON.stringify(value, null, 2);
    } else {
      displayValue = String(value ?? chalk.gray("-"));
    }
    table.push({ [chalk.cyan(key)]: displayValue });
  }

  return table.toString();
}

/**
 * Format a full learning object with detailed view
 */
function formatLearningDetail(learning: Learning): string {
  const lines: string[] = [];

  lines.push(chalk.bold.white(learning.title));
  lines.push(chalk.gray("─".repeat(60)));
  lines.push("");

  lines.push(`${chalk.cyan("ID:")}          ${learning.id}`);
  lines.push(`${chalk.cyan("Type:")}        ${formatType(learning.type)}`);
  lines.push(`${chalk.cyan("Scope:")}       ${formatScope(learning.scope)}`);
  lines.push(`${chalk.cyan("Confidence:")} ${formatConfidence(learning.confidence)}`);
  lines.push(
    `${chalk.cyan("Tags:")}        ${learning.tags.length > 0 ? learning.tags.join(", ") : chalk.gray("-")}`
  );

  if (learning.project_path) {
    lines.push(`${chalk.cyan("Project:")}     ${learning.project_path}`);
  }

  lines.push(`${chalk.cyan("Created:")}     ${formatDate(learning.created_at)}`);
  lines.push(`${chalk.cyan("Updated:")}     ${formatDate(learning.updated_at)}`);
  lines.push(`${chalk.cyan("Version:")}     ${learning.version}`);
  lines.push(`${chalk.cyan("Created by:")} ${learning.created_by}`);

  lines.push("");
  lines.push(chalk.cyan("Content:"));
  lines.push(chalk.gray("─".repeat(60)));
  lines.push(learning.content);

  if (learning.file_references.length > 0) {
    lines.push("");
    lines.push(chalk.cyan("File References:"));
    for (const ref of learning.file_references) {
      let refStr = `  - ${ref.path}`;
      if (ref.line_start) {
        refStr += `:${ref.line_start}`;
        if (ref.line_end && ref.line_end !== ref.line_start) {
          refStr += `-${ref.line_end}`;
        }
      }
      lines.push(refStr);
    }
  }

  if (learning.related_ids.length > 0) {
    lines.push("");
    lines.push(chalk.cyan("Related Learnings:"));
    for (const id of learning.related_ids) {
      lines.push(`  - ${id.slice(0, 8)}`);
    }
  }

  return lines.join("\n");
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

/**
 * Format scope with color
 */
function formatScope(scope: string): string {
  const colors: Record<string, (s: string) => string> = {
    project: chalk.gray,
    "cross-project": chalk.cyan,
    global: chalk.green,
  };
  return (colors[scope] ?? chalk.white)(scope);
}

/**
 * Format confidence with color
 */
function formatConfidence(confidence: string): string {
  const colors: Record<string, (s: string) => string> = {
    low: chalk.red,
    medium: chalk.yellow,
    high: chalk.green,
  };
  return (colors[confidence] ?? chalk.white)(confidence);
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green("✓") + " " + message);
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.error(chalk.red("✗") + " " + message);
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow("⚠") + " " + message);
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
  console.log(chalk.blue("ℹ") + " " + message);
}

/**
 * Format stats for display
 */
export function formatStats(stats: {
  total: number;
  embedded: number;
  byType: Record<string, number>;
  byScope: Record<string, number>;
  dbPath: string;
  embeddingProvider: string | null;
}): string {
  const lines: string[] = [];

  lines.push(chalk.bold.white("Code LTM Statistics"));
  lines.push(chalk.gray("─".repeat(40)));
  lines.push("");

  lines.push(`${chalk.cyan("Database:")}          ${stats.dbPath}`);
  lines.push(
    `${chalk.cyan("Embedding Provider:")} ${stats.embeddingProvider ?? chalk.gray("none")}`
  );
  lines.push("");

  lines.push(`${chalk.cyan("Total Learnings:")}   ${stats.total}`);
  lines.push(`${chalk.cyan("With Embeddings:")}   ${stats.embedded}`);
  lines.push("");

  lines.push(chalk.cyan("By Type:"));
  for (const [type, count] of Object.entries(stats.byType)) {
    lines.push(`  ${formatType(type).padEnd(20)} ${count}`);
  }

  lines.push("");
  lines.push(chalk.cyan("By Scope:"));
  for (const [scope, count] of Object.entries(stats.byScope)) {
    lines.push(`  ${formatScope(scope).padEnd(20)} ${count}`);
  }

  return lines.join("\n");
}

/**
 * Format config for display
 */
export function formatConfig(config: Record<string, unknown>): string {
  return yaml.stringify(config);
}
