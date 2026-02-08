import type { LearningRepository } from "../db/repository.js";
import { RecordLearningFeedbackInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const recordLearningFeedbackTool = {
  name: "record_learning_feedback",
  description: `Record an outcome signal for a learning.

Outcomes:
- used: applied but neutral confidence in quality impact
- helpful: materially useful learning
- dismissed: not useful, stale, or wrong`,
  inputSchema: zodToJsonSchema(RecordLearningFeedbackInputSchema),
};

export function handleRecordLearningFeedback(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const input = RecordLearningFeedbackInputSchema.parse(args);
  const metrics = repo.recordFeedback(
    input.id,
    input.outcome,
    input.source,
    input.context
  );

  if (!metrics) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { success: false, error: `Learning with id "${input.id}" not found` },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ success: true, metrics }, null, 2),
      },
    ],
  };
}
