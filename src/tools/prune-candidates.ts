import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { zodToJsonSchema } from "./add-learning.js";

const PruneCandidatesInputSchema = z.object({
  project_path: z.string().optional(),
  include_reasons: z.boolean().default(true),
});

export const pruneCandidatesTool = {
  name: "prune_candidates",
  description: `Identify learnings that may be candidates for cleanup.

Classifies candidates by reason:
- low_quality: More dismissals than helpful feedback
- stale: Old, never accessed, non-rule type
- never_accessed: Created >30 days ago, never accessed
- low_confidence_tip: Low confidence tips with minimal access

Each candidate appears once with its highest-priority reason.`,
  inputSchema: zodToJsonSchema(PruneCandidatesInputSchema),
};

type PruneReason = "low_quality" | "stale" | "never_accessed" | "low_confidence_tip";

interface PruneCandidate {
  id: string;
  title: string;
  type: string;
  reason: PruneReason;
  details: string;
  created_at: string;
  last_accessed_at: string | null;
}

export function handlePruneCandidates(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = PruneCandidatesInputSchema.parse(args);

  const allCandidates = repo.getPruneCandidates(input.project_path);
  const now = Date.now();
  const DAY_MS = 86400000;

  const seen = new Set<string>();
  const results: PruneCandidate[] = [];

  // Priority order: low_quality > stale > never_accessed > low_confidence_tip
  // Pass 1: low_quality
  for (const c of allCandidates) {
    if (c.dismissed_count > c.helpful_count && c.dismissed_count >= 2) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        results.push({
          id: c.id,
          title: c.title,
          type: c.type,
          reason: "low_quality",
          details: `dismissed ${c.dismissed_count}x vs helpful ${c.helpful_count}x`,
          created_at: c.created_at,
          last_accessed_at: c.last_accessed_at,
        });
      }
    }
  }

  // Pass 2: stale
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    const ageDays = (now - new Date(c.created_at).getTime()) / DAY_MS;
    if (ageDays > 90 && c.access_count === 0 && c.type !== "rule") {
      seen.add(c.id);
      results.push({
        id: c.id,
        title: c.title,
        type: c.type,
        reason: "stale",
        details: `created ${Math.round(ageDays)} days ago, never accessed`,
        created_at: c.created_at,
        last_accessed_at: c.last_accessed_at,
      });
    }
  }

  // Pass 3: never_accessed
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    const ageDays = (now - new Date(c.created_at).getTime()) / DAY_MS;
    if (ageDays > 30 && c.access_count === 0 && c.type !== "rule" && c.type !== "pattern") {
      seen.add(c.id);
      results.push({
        id: c.id,
        title: c.title,
        type: c.type,
        reason: "never_accessed",
        details: `created ${Math.round(ageDays)} days ago, never accessed`,
        created_at: c.created_at,
        last_accessed_at: c.last_accessed_at,
      });
    }
  }

  // Pass 4: low_confidence_tip
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    if (c.confidence === "low" && c.type === "tip" && c.access_count < 2) {
      seen.add(c.id);
      results.push({
        id: c.id,
        title: c.title,
        type: c.type,
        reason: "low_confidence_tip",
        details: `low confidence tip, accessed ${c.access_count}x`,
        created_at: c.created_at,
        last_accessed_at: c.last_accessed_at,
      });
    }
  }

  const summary = `Found ${results.length} prune candidates: ${
    results.filter((r) => r.reason === "low_quality").length
  } low_quality, ${
    results.filter((r) => r.reason === "stale").length
  } stale, ${
    results.filter((r) => r.reason === "never_accessed").length
  } never_accessed, ${
    results.filter((r) => r.reason === "low_confidence_tip").length
  } low_confidence_tip`;

  const output = input.include_reasons
    ? { candidates: results, summary }
    : { candidates: results.map(({ details: _d, ...rest }) => rest), summary };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(output, null, 2),
      },
    ],
  };
}
