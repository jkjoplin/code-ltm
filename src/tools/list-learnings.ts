import type { LearningRepository } from "../db/repository.js";
import { ListLearningsInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const listLearningsTool = {
  name: "list_learnings",
  description: `List learnings with optional filters.

Returns summaries (id, title, type, scope, tags, confidence) for context efficiency.
Use get_learning to retrieve full content for specific entries.

Pagination: Use limit and offset for large result sets.`,
  inputSchema: zodToJsonSchema(ListLearningsInputSchema),
};

export function handleListLearnings(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = ListLearningsInputSchema.parse(args);
  const learnings = repo.list(input);

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
