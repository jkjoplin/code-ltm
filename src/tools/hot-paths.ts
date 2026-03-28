import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { LearningTypeSchema } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

const HotPathsInputSchema = z.object({
  limit: z.number().int().positive().max(50).default(10),
  project_path: z.string().optional(),
  type: LearningTypeSchema.optional(),
  include_content: z.boolean().default(false),
});

export const hotPathsTool = {
  name: "hot_paths",
  description: `Find the most frequently accessed and useful learnings.

Returns learnings ranked by a combination of access frequency and usefulness score.
Use this to surface the most impactful knowledge in the system.`,
  inputSchema: zodToJsonSchema(HotPathsInputSchema),
};

export function handleHotPaths(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = HotPathsInputSchema.parse(args);

  const results = repo.hotPaths({
    limit: input.limit,
    project_path: input.project_path,
    type: input.type,
  });

  let learnings;
  if (input.include_content) {
    learnings = results.map((r) => {
      const full = repo.get(r.id);
      return {
        ...r,
        content: full?.content ?? "",
      };
    });
  } else {
    learnings = results;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { count: learnings.length, learnings },
          null,
          2
        ),
      },
    ],
  };
}
