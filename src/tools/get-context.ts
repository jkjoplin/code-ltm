import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { zodToJsonSchema } from "./add-learning.js";
import { toCompactLearning, compactJson } from "./compact.js";
import { getContextInternal } from "./context-shared.js";

const GetContextInputSchema = z.object({
  files: z.array(z.string()).optional(),
  query: z.string().optional(),
  project_path: z.string().optional(),
  max_results: z.number().int().positive().max(50).default(10),
  compact: z.boolean().default(false),
});

export const getContextTool = {
  name: "get_context",
  description: `Get all relevant knowledge for given files and/or query in one call.

Returns full learnings (not summaries) combining:
1. Rules with applies_to patterns matching the provided files (highest priority)
2. Learnings with file_references matching the provided files
3. Semantic/keyword search results for the query

At least one of 'files' or 'query' is required. This is the primary "what do we know
about these files?" tool — use it at the start of a task to load relevant context.`,
  inputSchema: zodToJsonSchema(GetContextInputSchema),
};

export async function handleGetContext(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = GetContextInputSchema.parse(args);

  if (!input.files?.length && !input.query) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "At least one of 'files' or 'query' is required" }),
        },
      ],
    };
  }

  const learnings = await getContextInternal(repo, {
    files: input.files,
    query: input.query,
    project_path: input.project_path,
    max_results: input.max_results,
  });

  if (learnings.length > 0) {
    repo.recordAccess(learnings.map((l) => l.id));
  }

  const result = input.compact
    ? { count: learnings.length, learnings: learnings.map(toCompactLearning) }
    : { count: learnings.length, learnings };

  return {
    content: [
      {
        type: "text",
        text: input.compact ? compactJson(result) : JSON.stringify(result, null, 2),
      },
    ],
  };
}
