import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { ScopeSchema, ConfidenceSchema } from "../types.js";
import type { Learning, LearningType } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

const ExportContextInputSchema = z.object({
  project_path: z.string().optional(),
  format: z.enum(["claude_md", "system_prompt", "rules_only", "json"]),
  scope: ScopeSchema.optional(),
  min_confidence: ConfidenceSchema.default("medium"),
  max_chars: z.number().int().positive().default(6000),
});

export const exportContextTool = {
  name: "export_context",
  description: `Export learnings as formatted context for AI agents.

Formats:
- claude_md: Markdown with sections (Rules, Patterns & Gotchas, Tips)
- system_prompt: Compact inline format for system prompts
- rules_only: Just the rules
- json: Full JSON array

Filters by confidence and scope. Enforces max_chars truncation.`,
  inputSchema: zodToJsonSchema(ExportContextInputSchema),
};

export function handleExportContext(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = ExportContextInputSchema.parse(args);

  const confidenceOrder = ["low", "medium", "high"];
  const minIdx = confidenceOrder.indexOf(input.min_confidence);

  // Fetch all non-deprecated learnings matching filters
  const summaries = repo.list({
    scope: input.scope,
    project_path: input.project_path,
    limit: 100,
    offset: 0,
    include_deprecated: false,
  });

  // Get full learnings and filter by confidence
  const learnings: Learning[] = [];
  for (const s of summaries) {
    const full = repo.get(s.id);
    if (!full) continue;
    const confIdx = confidenceOrder.indexOf(full.confidence);
    if (confIdx >= minIdx) {
      learnings.push(full);
    }
  }

  let content: string;

  switch (input.format) {
    case "claude_md":
      content = formatClaudeMd(learnings);
      break;
    case "system_prompt":
      content = formatSystemPrompt(learnings);
      break;
    case "rules_only":
      content = formatRulesOnly(learnings);
      break;
    case "json":
      content = JSON.stringify(learnings, null, 2);
      break;
  }

  // Truncate to max_chars
  if (content.length > input.max_chars) {
    content = content.slice(0, input.max_chars - 3) + "...";
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            format: input.format,
            char_count: content.length,
            learning_count: learnings.length,
            content,
          },
          null,
          2
        ),
      },
    ],
  };
}

function groupByType(learnings: Learning[]): Map<LearningType, Learning[]> {
  const groups = new Map<LearningType, Learning[]>();
  for (const l of learnings) {
    const existing = groups.get(l.type) ?? [];
    existing.push(l);
    groups.set(l.type, existing);
  }
  return groups;
}

function formatClaudeMd(learnings: Learning[]): string {
  const groups = groupByType(learnings);
  const lines: string[] = ["## Knowledge Base", ""];

  const sections: Array<{ heading: string; types: LearningType[] }> = [
    { heading: "### Rules", types: ["rule"] },
    { heading: "### Patterns & Gotchas", types: ["pattern", "gotcha"] },
    { heading: "### Tips", types: ["tip", "suggestion"] },
    { heading: "### Documentation", types: ["documentation", "investigation"] },
  ];

  for (const section of sections) {
    const items = section.types.flatMap((t) => groups.get(t) ?? []);
    if (items.length === 0) continue;
    lines.push(section.heading, "");
    for (const item of items) {
      lines.push(`- **${item.title}**: ${item.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatSystemPrompt(learnings: Learning[]): string {
  const lines: string[] = [];
  for (const l of learnings) {
    lines.push(`[${l.type.toUpperCase()}] ${l.title}: ${l.content}`);
  }
  return lines.join("\n");
}

function formatRulesOnly(learnings: Learning[]): string {
  const rules = learnings.filter((l) => l.type === "rule");
  if (rules.length === 0) return "No rules found.";
  return rules.map((r) => `- ${r.title}: ${r.content}`).join("\n");
}
