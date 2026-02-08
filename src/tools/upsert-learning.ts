import type { LearningRepository } from "../db/repository.js";
import { UpsertLearningInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const upsertLearningTool = {
  name: "upsert_learning",
  description: `Create or update a learning with optional explicit ID and metadata.

This is additive to add_learning/update_learning and is intended for trusted import
and autonomous workflows that need deterministic IDs/metadata preservation.`,
  inputSchema: zodToJsonSchema(UpsertLearningInputSchema),
};

export function handleUpsertLearning(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = UpsertLearningInputSchema.parse(args);
  const result = repo.upsert(input, input.created_by || "mcp-upsert");

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            created: result.created,
            skipped: result.skipped,
            id: result.learning.id,
            version: result.learning.version,
          },
          null,
          2
        ),
      },
    ],
  };
}
