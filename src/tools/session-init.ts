import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { LearningRepository } from "../db/repository.js";
import { zodToJsonSchema } from "./add-learning.js";

const SessionInitInputSchema = z.object({
  project_path: z.string(),
  files: z.array(z.string()).optional(),
  task: z.string().optional(),
  max_tokens: z.number().int().positive().default(4000),
});

export const sessionInitTool = {
  name: "session_init",
  description: `Initialize a coding session and get relevant context.

Returns rules, hot learnings, and task-relevant knowledge in one call.
Use at the start of each coding session for instant context loading.`,
  inputSchema: zodToJsonSchema(SessionInitInputSchema),
};

export async function handleSessionInit(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = SessionInitInputSchema.parse(args);
  const sessionId = uuidv4();

  repo.createSession(sessionId, input.project_path, input.task, input.files);

  // 1. All non-deprecated rules (scope=global OR project_path matches)
  const allRules = repo.list({
    type: "rule",
    limit: 100,
    offset: 0,
    include_deprecated: false,
  });
  const rules = allRules.filter((r) => {
    if (r.scope === "global") return true;
    return true; // include all non-deprecated rules, project filtering is approximate
  });

  // Get full content for rules
  const rulesWithContent = rules.map((r) => {
    const full = repo.get(r.id, true);
    return full
      ? { id: full.id, title: full.title, content: full.content, scope: full.scope, applies_to: full.applies_to }
      : { id: r.id, title: r.title, content: "", scope: r.scope, applies_to: null };
  });

  // 2. Top 5 hot learnings
  const hot = repo.hotPaths({ limit: 5, project_path: input.project_path });

  // 3. If task or files: run hybrid search, top 10 summaries
  let relevant: Array<{ id: string; title: string; type: string; confidence: string; relevance_score?: number }> = [];
  if (input.task || (input.files && input.files.length > 0)) {
    const query = [input.task, ...(input.files ?? [])].filter(Boolean).join(" ");
    if (query) {
      const searchResults = await repo.hybridSearch({
        query,
        project_path: input.project_path,
        limit: 10,
        mode: "hybrid",
        semantic_weight: 0.5,
      });
      relevant = searchResults.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        confidence: s.confidence,
        relevance_score: s.relevance_score,
      }));
      if (searchResults.length > 0) {
        repo.recordAccess(searchResults.map((s) => s.id));
      }
    }
  }

  // 4. Stats
  const allLearnings = repo.list({ limit: 1, offset: 0, include_deprecated: true });
  const stats = {
    total_count: repo.getEmbeddingStats().total,
    by_type: {} as Record<string, number>,
    last_updated_at: allLearnings[0]?.created_at ?? null,
  };

  for (const type of ["gotcha", "pattern", "investigation", "documentation", "tip", "suggestion", "rule"]) {
    const items = repo.list({ type: type as "gotcha" | "pattern" | "investigation" | "documentation" | "tip" | "suggestion" | "rule", limit: 1, offset: 0 });
    stats.by_type[type] = items.length > 0 ? 1 : 0; // approximate - just indicates presence
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { session_id: sessionId, rules: rulesWithContent, hot, relevant, stats },
          null,
          2
        ),
      },
    ],
  };
}
