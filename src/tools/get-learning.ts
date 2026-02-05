import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";

const GetLearningInputSchema = z.object({
  id: z.string().uuid(),
});

export const getLearningTool = {
  name: "get_learning",
  description: "Retrieve a single learning by its ID. Returns full content and all metadata.",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "The unique identifier of the learning to retrieve",
      },
    },
    required: ["id"],
  },
};

export function handleGetLearning(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = GetLearningInputSchema.parse(args);
  const learning = repo.get(input.id);

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
        text: JSON.stringify(learning, null, 2),
      },
    ],
  };
}
