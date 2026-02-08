import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import type { Learning } from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";
import { getContextInternal } from "./context-shared.js";

const RecallInputSchema = z.object({
  about: z.string().min(1),
  files: z.array(z.string()).optional(),
  project_path: z.string().optional(),
  max_tokens: z.number().int().positive().default(2000),
});

export const recallTool = {
  name: "recall",
  description: `Recall relevant knowledge as a compact markdown block, optimized for token budget.

Returns formatted markdown (not JSON) with the most relevant learnings for the given
topic and/or files, fitted within the specified token budget.

Use this when you want a quick context injection without parsing JSON.
The output degrades gracefully: full content → truncated → title-only as budget tightens.`,
  inputSchema: zodToJsonSchema(RecallInputSchema),
};

export async function handleRecall(
  repo: LearningRepository,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const input = RecallInputSchema.parse(args);
  const maxChars = input.max_tokens * 4; // ~4 chars per token estimate

  const learnings = await getContextInternal(repo, {
    files: input.files,
    query: input.about,
    project_path: input.project_path,
    max_results: 20, // fetch more, we'll trim by budget
  });

  if (learnings.length > 0) {
    repo.recordAccess(learnings.map((l) => l.id));
  }

  if (learnings.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `_No knowledge found about: ${input.about}_`,
        },
      ],
    };
  }

  const output = formatRecallMarkdown(learnings, input.about, maxChars);

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

function formatRecallMarkdown(
  learnings: Learning[],
  topic: string,
  maxChars: number
): string {
  const lines: string[] = [];
  let charCount = 0;
  let included = 0;

  const addLine = (line: string): boolean => {
    const cost = line.length + 1;
    if (charCount + cost > maxChars) return false;
    lines.push(line);
    charCount += cost;
    return true;
  };

  const header = `## Recalled Knowledge: ${topic}`;
  if (!addLine(header)) return `_Budget too small to recall knowledge about: ${topic}_`;

  for (const l of learnings) {
    const shortId = l.id.slice(0, 8);
    const heading = `### ${l.title} [${shortId}]`;
    const meta = `**${l.type}** | ${l.confidence} confidence`;

    // Try full block
    const fullBlock = `${heading}\n${meta}\n${l.content}`;
    if (charCount + fullBlock.length + 2 <= maxChars) {
      addLine("");
      addLine(heading);
      addLine(meta);
      addLine(l.content);
      included++;
      continue;
    }

    // Try truncated content
    const remaining = maxChars - charCount - heading.length - meta.length - 10;
    if (remaining > 100) {
      addLine("");
      addLine(heading);
      addLine(meta);
      addLine(l.content.slice(0, remaining).replace(/\n+/g, " ").trim() + "...");
      included++;
      continue;
    }

    // Try title-only
    const titleOnly = `- **${l.title}** [${shortId}] (${l.type})`;
    if (charCount + titleOnly.length + 1 <= maxChars) {
      addLine(titleOnly);
      included++;
      continue;
    }

    // Budget exhausted
    break;
  }

  const remaining = learnings.length - included;
  if (remaining > 0) {
    const footer = `\n_${included} learning${included === 1 ? "" : "s"} recalled. ${remaining} more available. Use get_learning <id> for full details._`;
    if (charCount + footer.length <= maxChars) {
      addLine(footer);
    }
  } else {
    const footer = `\n_${included} learning${included === 1 ? "" : "s"} recalled. Use get_learning <id> for full details._`;
    if (charCount + footer.length <= maxChars) {
      addLine(footer);
    }
  }

  return lines.join("\n");
}
