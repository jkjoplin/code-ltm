import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { toCompactLearning, compactJson } from "./compact.js";

const GetLearningInputSchema = z.object({
  id: z.string().uuid(),
  compact: z.boolean().default(false),
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
      compact: {
        type: "boolean",
        description: "Return compact format with abbreviated keys (saves tokens)",
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
  const learning = repo.get(input.id, true);

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

  // Prefix title with [DEPRECATED] for deprecated learnings
  const result = learning.deprecated
    ? { ...learning, title: `[DEPRECATED] ${learning.title}` }
    : learning;

  if (input.compact) {
    return {
      content: [
        {
          type: "text",
          text: compactJson(toCompactLearning(result)),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
