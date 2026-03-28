import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { zodToJsonSchema } from "./add-learning.js";

const MarkSupersededInputSchema = z.object({
  old_id: z.string().uuid(),
  new_id: z.string().uuid(),
  reason: z.string().optional(),
});

export const markSupersededTool = {
  name: "mark_superseded",
  description: `Mark a learning as superseded by a newer one.

Sets the superseded_by field on the old learning and creates a
bidirectional link between the old and new learnings.
Use when knowledge has been replaced or updated by a newer learning.`,
  inputSchema: zodToJsonSchema(MarkSupersededInputSchema),
};

export function handleMarkSuperseded(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = MarkSupersededInputSchema.parse(args);

  if (input.old_id === input.new_id) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: "Cannot supersede a learning with itself" }),
        },
      ],
    };
  }

  const oldLearning = repo.get(input.old_id);
  const newLearning = repo.get(input.new_id);

  if (!oldLearning || !newLearning) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, error: "One or both learnings not found" }),
        },
      ],
    };
  }

  repo.markSuperseded(input.old_id, input.new_id, input.reason);
  repo.linkLearnings(input.old_id, input.new_id);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            old_id: input.old_id,
            new_id: input.new_id,
            old_title: oldLearning.title,
            new_title: newLearning.title,
          },
          null,
          2
        ),
      },
    ],
  };
}
