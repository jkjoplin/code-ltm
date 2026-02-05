import type { LearningRepository } from "../db/repository.js";
import { ReembedLearningsInputSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

export const reembedLearningsTool = {
  name: "reembed_learnings",
  description: `Generate or regenerate embeddings for learnings.

Use this tool to:
- Generate embeddings for existing learnings that don't have them
- Force regeneration of all embeddings (e.g., after changing providers)

Parameters:
- force: If true, re-embed all learnings. If false, only embed those without embeddings.
- batch_size: Number of learnings to process per batch (default 10).

Returns progress statistics.`,
  inputSchema: zodToJsonSchema(ReembedLearningsInputSchema),
};

export async function handleReembedLearnings(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = ReembedLearningsInputSchema.parse(args);

  if (!repo.isSemanticSearchAvailable()) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error:
                "No embedding provider available. Start Ollama or set OPENAI_API_KEY.",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const stats = repo.getEmbeddingStats();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  if (input.force) {
    // Re-embed all learnings
    let offset = 0;
    while (true) {
      const batch = repo.getAllLearningsForEmbedding(input.batch_size, offset);
      if (batch.length === 0) break;

      for (const learning of batch) {
        processed++;
        try {
          const result = await repo.generateEmbedding(
            learning.id,
            learning.title,
            learning.content
          );
          if (result) {
            succeeded++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          console.error(
            `Failed to embed learning ${learning.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      offset += input.batch_size;
    }
  } else {
    // Only embed those without embeddings
    while (true) {
      const batch = repo.getLearningsWithoutEmbeddings(input.batch_size);
      if (batch.length === 0) break;

      for (const learning of batch) {
        processed++;
        try {
          const result = await repo.generateEmbedding(
            learning.id,
            learning.title,
            learning.content
          );
          if (result) {
            succeeded++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          console.error(
            `Failed to embed learning ${learning.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }
  }

  const finalStats = repo.getEmbeddingStats();

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            mode: input.force ? "force" : "incremental",
            processed,
            succeeded,
            failed,
            before: stats,
            after: finalStats,
          },
          null,
          2
        ),
      },
    ],
  };
}
