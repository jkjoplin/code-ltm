import type { LearningRepository } from "../db/repository.js";
import { ListLearningsInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";
import { toCompactSummary, compactJson } from "./compact.js";

export const listLearningsTool = {
  name: "list_learnings",
  description: `List learnings with optional filters.

Returns summaries (id, title, type, scope, tags, confidence) for context efficiency.
Use get_learning to retrieve full content for specific entries.

Pagination: Use limit and offset for large result sets.
Set include_deprecated: true to include deprecated learnings.
Set compact: true for abbreviated keys (saves tokens).`,
  inputSchema: zodToJsonSchema(ListLearningsInputSchema),
};

export function handleListLearnings(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = ListLearningsInputSchema.parse(args);
  const learnings = repo.list({
    scope: input.scope,
    type: input.type,
    tags: input.tags,
    project_path: input.project_path,
    limit: input.limit,
    offset: input.offset,
    include_deprecated: input.include_deprecated,
  });

  if (input.compact) {
    return {
      content: [
        {
          type: "text",
          text: compactJson({
            count: learnings.length,
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
            learnings,
          },
          null,
          2
        ),
      },
    ],
  };
}
