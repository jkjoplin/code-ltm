import type { LearningRepository } from "../db/repository.js";
import { SearchLearningsInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";
import { toCompactSummary, toCompactLearning, compactJson } from "./compact.js";

export const searchLearningsTool = {
  name: "search_learnings",
  description: `Search learnings using keyword, semantic, or hybrid search.

Search modes:
- keyword: SQLite FTS5 keyword matching (fast, exact)
- semantic: Vector similarity search (finds conceptually similar content)
- hybrid: Combines keyword + semantic scores (default, best of both)

Returns summaries by default for context efficiency.
Set include_content: true to get full content (uses more context).
Set include_deprecated: true to include deprecated learnings.
Set compact: true for abbreviated keys (saves tokens).

semantic_weight (0-1) controls the balance in hybrid mode:
- 0 = pure keyword
- 0.5 = equal weight (default)
- 1 = pure semantic`,
  inputSchema: zodToJsonSchema(SearchLearningsInputSchema),
};

export async function handleSearchLearnings(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = SearchLearningsInputSchema.parse(args);

  try {
    // Use hybrid search (handles mode internally)
    const learnings = await repo.hybridSearch({
      query: input.query,
      scope: input.scope,
      type: input.type,
      tags: input.tags,
      project_path: input.project_path,
      limit: input.limit,
      mode: input.mode,
      semantic_weight: input.semantic_weight,
      include_deprecated: input.include_deprecated,
    });

    // If include_content is true, fetch full content
    if (input.include_content) {
      const fullLearnings = learnings.map((summary) => {
        const full = repo.get(summary.id);
        return {
          ...full,
          relevance_score: summary.relevance_score,
        };
      });

      if (input.compact) {
        return {
          content: [
            {
              type: "text",
              text: compactJson({
                count: fullLearnings.length,
                mode: input.mode,
                learnings: fullLearnings.map((l) => l ? toCompactLearning(l as any) : null),
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: fullLearnings.length,
                mode: input.mode,
                semantic_available: repo.isSemanticSearchAvailable(),
                learnings: fullLearnings,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (input.compact) {
      return {
        content: [
          {
            type: "text",
            text: compactJson({
              count: learnings.length,
              mode: input.mode,
              learnings: learnings.map(toCompactSummary),
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: learnings.length,
              mode: input.mode,
              semantic_available: repo.isSemanticSearchAvailable(),
              learnings,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    // FTS can fail with certain query syntaxes
    const message =
      error instanceof Error ? error.message : "Search failed";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: `Search failed: ${message}. Try simplifying your query.`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}
