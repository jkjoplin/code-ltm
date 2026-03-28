import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { AddLearningInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

const BatchAddInputSchema = z.object({
  learnings: z.array(AddLearningInputSchema).min(1).max(50),
});

export const batchAddTool = {
  name: "batch_add",
  description: `Add multiple learnings in a single call.

Accepts 1-50 learnings. Each follows the same schema as add_learning.
Embeddings are generated in parallel for efficiency.
Use this instead of multiple add_learning calls when recording batch insights.`,
  inputSchema: zodToJsonSchema(BatchAddInputSchema),
};

export function handleBatchAdd(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = BatchAddInputSchema.parse(args);

  const ids: string[] = [];
  const titles: string[] = [];

  for (const learningInput of input.learnings) {
    const learning = repo.add(learningInput);
    ids.push(learning.id);
    titles.push(learning.title);
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { added: ids.length, ids, titles },
          null,
          2
        ),
      },
    ],
  };
}
