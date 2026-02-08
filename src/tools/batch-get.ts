import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import type { Learning } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";
import { toCompactLearning, compactJson } from "./compact.js";

const BatchGetInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  compact: z.boolean().default(false),
});

export const batchGetTool = {
  name: "batch_get",
  description: `Retrieve multiple learnings by their IDs in a single call.

Returns full content for each found learning and lists any IDs not found.
Accepts 1-50 UUIDs. Use this instead of multiple get_learning calls.`,
  inputSchema: zodToJsonSchema(BatchGetInputSchema),
};

export function handleBatchGet(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = BatchGetInputSchema.parse(args);

  const found: Learning[] = [];
  const not_found: string[] = [];

  for (const id of input.ids) {
    const learning = repo.get(id, true);
    if (learning) {
      found.push(learning);
    } else {
      not_found.push(id);
    }
  }

  const result = input.compact
    ? { found: found.map(toCompactLearning), not_found }
    : { found, not_found };

  return {
    content: [
      {
        type: "text",
        text: input.compact ? compactJson(result) : JSON.stringify(result, null, 2),
      },
    ],
  };
}
