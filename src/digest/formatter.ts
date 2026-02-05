import type { LearningType } from "../types.js";
import type { DigestOptions, DigestResult, DigestStats, ScoredLearning } from "./types.js";

const TYPE_ORDER: LearningType[] = ["gotcha", "pattern", "tip", "documentation", "investigation"];

const TYPE_LABELS: Record<LearningType, string> = {
  gotcha: "Gotchas",
  pattern: "Patterns",
  tip: "Tips",
  documentation: "Documentation",
  investigation: "Investigations",
};

export function formatDigest(
  learnings: ScoredLearning[],
  options: DigestOptions,
  totalMatched: number
): DigestResult {
  switch (options.format) {
    case "index":
      return formatIndex(learnings, options, totalMatched);
    case "json":
      return formatJson(learnings, options, totalMatched);
    case "markdown":
    default:
      return formatMarkdown(learnings, options, totalMatched);
  }
}

function formatMarkdown(
  learnings: ScoredLearning[],
  options: DigestOptions,
  totalMatched: number
): DigestResult {
  const lines: string[] = [];
  let charCount = 0;
  let included = 0;
  let truncated = 0;
  let budgetExhausted = false;

  const addLine = (line: string): boolean => {
    const cost = line.length + 1; // +1 for newline
    if (charCount + cost > options.max_chars) {
      budgetExhausted = true;
      return false;
    }
    lines.push(line);
    charCount += cost;
    return true;
  };

  if (options.group_by_type) {
    const grouped = new Map<LearningType, ScoredLearning[]>();
    for (const l of learnings) {
      const group = grouped.get(l.type) ?? [];
      group.push(l);
      grouped.set(l.type, group);
    }

    for (const type of TYPE_ORDER) {
      const group = grouped.get(type);
      if (!group || group.length === 0) continue;
      if (budgetExhausted) break;

      if (!addLine(`### ${TYPE_LABELS[type]}`)) break;
      if (!addLine("")) break;

      for (const l of group) {
        if (budgetExhausted) break;
        const result = renderLearningMarkdown(l, options, charCount);
        if (charCount + result.cost > options.max_chars) {
          // Try title-only as degradation
          const titleOnly = renderTitleOnly(l, options);
          if (charCount + titleOnly.cost <= options.max_chars) {
            lines.push(titleOnly.text);
            charCount += titleOnly.cost;
            included++;
            truncated++;
          } else {
            budgetExhausted = true;
          }
        } else {
          lines.push(result.text);
          charCount += result.cost;
          included++;
          if (result.wasTruncated) truncated++;
        }
      }

      if (!budgetExhausted) addLine("");
    }
  } else {
    for (const l of learnings) {
      if (budgetExhausted) break;
      const result = renderLearningMarkdown(l, options, charCount);
      if (charCount + result.cost > options.max_chars) {
        const titleOnly = renderTitleOnly(l, options);
        if (charCount + titleOnly.cost <= options.max_chars) {
          lines.push(titleOnly.text);
          charCount += titleOnly.cost;
          included++;
          truncated++;
        } else {
          budgetExhausted = true;
        }
      } else {
        lines.push(result.text);
        charCount += result.cost;
        included++;
        if (result.wasTruncated) truncated++;
      }
    }
  }

  const omitted = totalMatched - included;

  // Footer
  if (omitted > 0) {
    const footer = `\n_${omitted} additional learning${omitted === 1 ? "" : "s"} omitted. Use \`get_learning <id>\` for full content._`;
    if (charCount + footer.length <= options.max_chars) {
      lines.push(footer);
      charCount += footer.length;
    }
  }

  if (options.include_metadata) {
    const meta = `\n<!-- Generated: ${new Date().toISOString()} | ${included}/${totalMatched} learnings -->`;
    if (charCount + meta.length <= options.max_chars) {
      lines.push(meta);
      charCount += meta.length;
    }
  }

  const stats = buildStats(totalMatched, included, truncated, omitted, charCount, options);
  return { output: lines.join("\n"), stats };
}

function formatIndex(
  learnings: ScoredLearning[],
  options: DigestOptions,
  totalMatched: number
): DigestResult {
  const lines: string[] = [];
  let charCount = 0;
  let included = 0;

  const header = "| ID | Title | Type | Confidence | Tags |";
  const separator = "|---|---|---|---|---|";
  lines.push(header, separator);
  charCount = header.length + 1 + separator.length + 1;

  for (const l of learnings) {
    const shortId = options.include_ids ? l.id.slice(0, 8) : "-";
    const tags = l.tags.length > 0 ? l.tags.join(", ") : "-";
    const row = `| ${shortId} | ${l.title} | ${l.type} | ${l.confidence} | ${tags} |`;
    const cost = row.length + 1;

    if (charCount + cost > options.max_chars) break;

    lines.push(row);
    charCount += cost;
    included++;
  }

  const omitted = totalMatched - included;
  const stats = buildStats(totalMatched, included, 0, omitted, charCount, options);
  return { output: lines.join("\n"), stats };
}

function formatJson(
  learnings: ScoredLearning[],
  options: DigestOptions,
  totalMatched: number
): DigestResult {
  const included = learnings.length;
  const entries = learnings.map((l) => ({
    id: l.id,
    title: l.title,
    content: l.content.length > options.max_content_length
      ? l.content.slice(0, options.max_content_length) + "..."
      : l.content,
    type: l.type,
    confidence: l.confidence,
    tags: l.tags,
    score: l.score,
  }));

  const truncated = learnings.filter(
    (l) => l.content.length > options.max_content_length
  ).length;

  const stats = buildStats(totalMatched, included, truncated, totalMatched - included, 0, options);
  const result = { learnings: entries, stats };
  const output = JSON.stringify(result, null, 2);
  stats.character_count = output.length;
  return { output, stats };
}

function renderLearningMarkdown(
  learning: ScoredLearning,
  options: DigestOptions,
  _currentChars: number
): { text: string; cost: number; wasTruncated: boolean } {
  const idPart = options.include_ids ? ` [${learning.id.slice(0, 8)}]` : "";
  let content = learning.content;
  let wasTruncated = false;

  if (content.length > options.max_content_length) {
    content = content.slice(0, options.max_content_length) + "...";
    wasTruncated = true;
  }

  // Replace newlines in content with spaces for compact display
  content = content.replace(/\n+/g, " ").trim();

  const text = `- **${learning.title}**${idPart}\n  ${content}`;
  return { text, cost: text.length + 1, wasTruncated };
}

function renderTitleOnly(
  learning: ScoredLearning,
  options: DigestOptions
): { text: string; cost: number } {
  const idPart = options.include_ids ? ` [${learning.id.slice(0, 8)}]` : "";
  const text = `- **${learning.title}**${idPart}`;
  return { text, cost: text.length + 1 };
}

function buildStats(
  totalMatched: number,
  included: number,
  truncated: number,
  omitted: number,
  charCount: number,
  options: DigestOptions
): DigestStats {
  const filters: Record<string, string> = {};
  if (options.scope) filters.scope = options.scope;
  if (options.type) filters.type = options.type;
  if (options.tags?.length) filters.tags = options.tags.join(", ");
  if (options.project_path) filters.project_path = options.project_path;
  if (options.min_confidence) filters.min_confidence = options.min_confidence;
  if (options.require_tag) filters.require_tag = options.require_tag;

  return {
    total_matched: totalMatched,
    total_included: included,
    total_truncated: truncated,
    total_omitted: omitted,
    character_count: charCount,
    generated_at: new Date().toISOString(),
    filters_applied: filters,
  };
}
