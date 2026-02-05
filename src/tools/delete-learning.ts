import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";

const DeleteLearningInputSchema = z.object({
  id: z.string().uuid(),
});

export const deleteLearningTool = {
  name: "delete_learning",
  description: "Permanently delete a learning by its ID.",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "The unique identifier of the learning to delete",
      },
    },
    required: ["id"],
  },
};

export function handleDeleteLearning(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = DeleteLearningInputSchema.parse(args);
  const deleted = repo.delete(input.id);

  if (!deleted) {
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
            message: `Learning deleted successfully`,
          },
          null,
          2
        ),
      },
    ],
  };
}
