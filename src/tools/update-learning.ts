import type { LearningRepository } from "../db/repository.js";
import { UpdateLearningInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const updateLearningTool = {
  name: "update_learning",
  description: `Update an existing learning. Only provide fields you want to change.

The learning's version will be incremented automatically.
Tags, file_references, and related_ids will be completely replaced if provided.`,
  inputSchema: zodToJsonSchema(UpdateLearningInputSchema),
};

export function handleUpdateLearning(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = UpdateLearningInputSchema.parse(args);
  const learning = repo.update(input);

  if (!learning) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: `Learning with id "${input.id}" not found`,
            },
            null,
            2
          ),
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
            success: true,
            message: `Learning "${learning.title}" updated successfully`,
            version: learning.version,
          },
          null,
          2
        ),
      },
    ],
  };
}
