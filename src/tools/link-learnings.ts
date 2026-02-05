import type { LearningRepository } from "../db/repository.js";
import { LinkLearningsInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const linkLearningsTool = {
  name: "link_learnings",
  description: `Create a bidirectional relationship between two learnings.

Use this to connect related concepts, patterns, or investigations.
The link is bidirectional - both learnings will reference each other.`,
  inputSchema: zodToJsonSchema(LinkLearningsInputSchema),
};

export function handleLinkLearnings(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = LinkLearningsInputSchema.parse(args);

  if (input.source_id === input.target_id) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: "Cannot link a learning to itself",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const success = repo.linkLearnings(input.source_id, input.target_id);

  if (!success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: "One or both learnings not found",
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
            message: "Learnings linked successfully",
          },
          null,
          2
        ),
      },
    ],
  };
}
