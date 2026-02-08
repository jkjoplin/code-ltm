import type { LearningRepository } from "../db/repository.js";
import { RunAutonomyCycleInputSchema } from "../types.js";
import { runAutonomyCycle } from "../autonomy/index.js";
import { zodToJsonSchema } from "./add-learning.js";

export const runAutonomyCycleTool = {
  name: "run_autonomy_cycle",
  description: `Run autonomous memory collection and optional maintenance.

Sources:
- git: captures recent commit and changed file context
- tests: captures failing test signal from local test output logs
- pr: captures local PR note guidance

Set maintenance=true to run duplicate/conflict/staleness/promotion suggestion pass.`,
  inputSchema: zodToJsonSchema(RunAutonomyCycleInputSchema),
};

export async function handleRunAutonomyCycle(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const input = RunAutonomyCycleInputSchema.parse(args);
  try {
    const result = await runAutonomyCycle(repo, input);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error:
                error instanceof Error ? error.message : "Autonomy cycle failed",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
