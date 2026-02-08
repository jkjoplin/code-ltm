import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import type { ScoredLearning } from "../digest/types.js";
import {
  CONFIDENCE_ORDER,
  TYPE_PRIORITY,
  calculateRecencyBonus,
} from "../digest/generator.js";
import { formatDigest } from "../digest/formatter.js";
import { zodToJsonSchema } from "./add-learning.js";

const DigestFormatSchema = z.enum(["markdown", "index", "json"]);

const GetDigestInputSchema = z.object({
  task: z.string().optional(),
  files: z.array(z.string()).optional(),
  project_path: z.string().optional(),
  max_chars: z.number().int().positive().default(8192),
  format: DigestFormatSchema.default("markdown"),
});

export const getDigestTool = {
  name: "get_digest",
  description: `Generate a knowledge digest, optionally boosted for a specific task and files.

Without task/files: returns the standard digest (same as CLI 'code-ltm-cli digest').
With task/files: re-scores learnings with a +30 boost for:
- Learnings whose file_refs match the provided files
- Rules whose applies_to globs match the provided files
- Learnings semantically similar to the task query

Formats:
- markdown: Grouped by type with content (default)
- index: Compact table format
- json: Machine-readable with scores`,
  inputSchema: zodToJsonSchema(GetDigestInputSchema),
};

export async function handleGetDigest(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = GetDigestInputSchema.parse(args);

  // Get all non-deprecated learnings
  const summaries = repo.list({
    project_path: input.project_path,
    limit: 10000,
    offset: 0,
    include_deprecated: false,
  });

  // Build set of boosted IDs
  const boostedIds = new Set<string>();

  if (input.files && input.files.length > 0) {
    // Boost rules matching files
    const matchingRules = repo.findMatchingRules(input.files, input.project_path);
    for (const rule of matchingRules) {
      boostedIds.add(rule.id);
    }

    // Boost learnings with matching file refs
    const fileRefLearnings = repo.findByFileRefs(input.files, 100);
    for (const l of fileRefLearnings) {
      boostedIds.add(l.id);
    }
  }

  if (input.task) {
    // Boost learnings semantically similar to task
    try {
      const searchResults = await repo.hybridSearch({
        query: input.task,
        project_path: input.project_path,
        limit: 30,
        include_deprecated: false,
      });
      for (const s of searchResults) {
        boostedIds.add(s.id);
      }
    } catch {
      // Search may fail, continue without boost
    }
  }

  // Score all learnings
  const scoredLearnings: ScoredLearning[] = [];
  for (const summary of summaries) {
    const full = repo.get(summary.id);
    if (!full || full.deprecated) continue;

    const typePriority = (TYPE_PRIORITY[full.type] ?? 1) * 10;
    const confidenceBoost = CONFIDENCE_ORDER[full.confidence] * 5;
    const digestTagBonus = full.tags.includes("digest") ? 20 : 0;
    const recencyBonus = calculateRecencyBonus(full.created_at);
    const accessBonus = Math.min(full.access_count, 10);
    const taskBoost = boostedIds.has(full.id) ? 30 : 0;

    const score = typePriority + confidenceBoost + digestTagBonus + recencyBonus + accessBonus + taskBoost;

    scoredLearnings.push({
      id: full.id,
      title: full.title,
      content: full.content,
      type: full.type,
      scope: full.scope,
      confidence: full.confidence,
      tags: full.tags,
      created_at: full.created_at,
      score,
      access_count: full.access_count,
    });
  }

  // Sort by score descending
  scoredLearnings.sort((a, b) => b.score - a.score);

  const result = formatDigest(scoredLearnings, {
    format: input.format,
    max_chars: input.max_chars,
    max_content_length: 500,
    min_confidence: "low",
    group_by_type: true,
    include_ids: true,
    include_metadata: true,
  }, summaries.length);

  return {
    content: [
      {
        type: "text",
        text: result.output,
      },
    ],
  };
}
