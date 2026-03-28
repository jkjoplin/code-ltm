import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { zodToJsonSchema } from "./add-learning.js";
import { generateAgentsDigest } from "../digest/auto-generate.js";

const TaskEndInputSchema = z.object({
  session_id: z.string(),
  outcome: z.enum(["success", "partial", "abandoned"]),
  summary: z.string().optional(),
  new_learning_ids: z.array(z.string().uuid()).optional(),
});

export const taskEndTool = {
  name: "task_end",
  description: `Close a coding session and record its outcome.

Call this when a task is complete, partially done, or abandoned.
Records duration and any new learnings added during the session.`,
  inputSchema: zodToJsonSchema(TaskEndInputSchema),
};

export function handleTaskEnd(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = TaskEndInputSchema.parse(args);

  const session = repo.getSession(input.session_id);
  if (!session) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Session not found: ${input.session_id}` }),
        },
      ],
    };
  }

  const learningIds = input.new_learning_ids ?? [];
  repo.closeSession(input.session_id, input.outcome, learningIds);

  const startedAt = new Date(session.started_at).getTime();
  const endedAt = Date.now();
  const durationMinutes = Math.round((endedAt - startedAt) / 60000);

  // Auto-regenerate agents digest on session close
  let digestPath: string | null = null;
  try {
    digestPath = generateAgentsDigest(repo);
  } catch {
    // Non-fatal: digest generation failure should not break task_end
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            session_closed: true,
            duration_minutes: durationMinutes,
            learnings_recorded: learningIds.length,
            digest_updated: digestPath,
          },
          null,
          2
        ),
      },
    ],
  };
}
