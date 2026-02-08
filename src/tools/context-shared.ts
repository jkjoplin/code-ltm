import type { LearningRepository } from "../db/repository.js";
import type { Learning } from "../types.js";

interface ScoredResult {
  learning: Learning;
  score: number;
  source: string;
}

export interface ContextOptions {
  files?: string[];
  query?: string;
  project_path?: string;
  max_results?: number;
}

export async function getContextInternal(
  repo: LearningRepository,
  options: ContextOptions
): Promise<Learning[]> {
  const { files, query, project_path, max_results = 10 } = options;
  const results = new Map<string, ScoredResult>();

  // 1. Rules (score 100) — glob-matched rules for provided files
  if (files && files.length > 0) {
    const rules = repo.findMatchingRules(files, project_path);
    for (const rule of rules) {
      if (!results.has(rule.id)) {
        results.set(rule.id, { learning: rule, score: 100, source: "rule" });
      }
    }
  }

  // 2. File refs (score 50) — learnings referencing those files
  if (files && files.length > 0) {
    const fileRefResults = repo.findByFileRefs(files, max_results * 2);
    for (const learning of fileRefResults) {
      if (!results.has(learning.id)) {
        results.set(learning.id, { learning, score: 50, source: "file_ref" });
      }
    }
  }

  // 3. Search (score 0-40) — semantic/keyword matches
  if (query) {
    try {
      const searchSummaries = await repo.hybridSearch({
        query,
        project_path,
        limit: max_results * 2,
        include_deprecated: false,
      });

      for (let i = 0; i < searchSummaries.length; i++) {
        const summary = searchSummaries[i]!;
        if (!results.has(summary.id)) {
          // Score decays from 40 to 0 based on position
          const score = Math.max(0, 40 - (i * 40) / Math.max(searchSummaries.length - 1, 1));
          const full = repo.get(summary.id);
          if (full && !full.deprecated) {
            results.set(full.id, { learning: full, score, source: "search" });
          }
        }
      }
    } catch {
      // Search may fail with certain queries, continue with other results
    }
  }

  // Sort by score descending, take max_results
  const sorted = Array.from(results.values())
    .map((item) => {
      const usefulness = repo.getUsefulnessScore(item.learning.id);
      const ageDays =
        (Date.now() - new Date(item.learning.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      const recency = Math.max(0, 1 - ageDays / 365);
      const finalScore = item.score * 0.55 + usefulness * 40 * 0.3 + recency * 40 * 0.15;
      return { ...item, score: finalScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max_results);

  return sorted.map((r) => r.learning);
}
