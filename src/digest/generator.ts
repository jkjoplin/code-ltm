import type { LearningRepository } from "../db/repository.js";
import type { Confidence, LearningType } from "../types.js";
import { formatDigest } from "./formatter.js";
import type { DigestOptions, DigestResult, ScoredLearning } from "./types.js";

export const CONFIDENCE_ORDER: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const TYPE_PRIORITY: Record<LearningType, number> = {
  rule: 6,
  gotcha: 5,
  pattern: 4,
  tip: 3,
  suggestion: 2,
  documentation: 2,
  investigation: 1,
};

const DEFAULT_OPTIONS: DigestOptions = {
  min_confidence: "medium",
  format: "markdown",
  max_chars: 8192,
  max_content_length: 500,
  group_by_type: true,
  include_ids: true,
  include_metadata: true,
};

export function getDefaultOptions(): DigestOptions {
  return { ...DEFAULT_OPTIONS };
}

export function generateDigest(
  repo: LearningRepository,
  options: Partial<DigestOptions> = {}
): DigestResult {
  const opts: DigestOptions = { ...DEFAULT_OPTIONS, ...options };

  // 1. Query DB with filters (exclude deprecated)
  const summaries = repo.list({
    scope: opts.scope,
    type: opts.type,
    tags: opts.tags,
    project_path: opts.project_path,
    limit: 10000,
    offset: 0,
    include_deprecated: false,
  });

  // 2. Filter by min_confidence and require_tag in-memory
  const minConfidenceLevel = CONFIDENCE_ORDER[opts.min_confidence];
  const filtered = summaries.filter((s) => {
    const confLevel = CONFIDENCE_ORDER[s.confidence];
    if (confLevel < minConfidenceLevel) return false;
    if (opts.require_tag && !s.tags.includes(opts.require_tag)) return false;
    return true;
  });

  const totalMatched = filtered.length;

  // 3. Fetch full content for each (skip deprecated)
  const scoredLearnings: ScoredLearning[] = [];
  for (const summary of filtered) {
    const full = repo.get(summary.id);
    if (!full || full.deprecated) continue;

    // 4. Score each learning
    const typePriority = TYPE_PRIORITY[full.type] * 10;
    const confidenceBoost = CONFIDENCE_ORDER[full.confidence] * 5;
    const digestTagBonus = full.tags.includes("digest") ? 20 : 0;
    const recencyBonus = calculateRecencyBonus(full.created_at);
    const accessBonus = Math.min(full.access_count, 10);
    const score = typePriority + confidenceBoost + digestTagBonus + recencyBonus + accessBonus;

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

  // 5. Sort descending by score
  scoredLearnings.sort((a, b) => b.score - a.score);

  // 6. Pass to formatter with budget
  return formatDigest(scoredLearnings, opts, totalMatched);
}

export function calculateRecencyBonus(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  // 0-5 bonus: 5 for today, decaying over 30 days
  return Math.max(0, 5 * (1 - ageDays / 30));
}
