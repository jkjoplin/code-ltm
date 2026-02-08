import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import {
  ScopeSchema,
  ConfidenceSchema,
  FileRefSchema,
} from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

const AddRuleInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  applies_to: z.array(z.string().min(1)).min(1),
  scope: ScopeSchema,
  project_path: z.string().optional(),
  tags: z.array(z.string()).default([]),
  file_references: z.array(FileRefSchema).default([]),
  related_ids: z.array(z.string().uuid()).default([]),
  confidence: ConfidenceSchema.default("high"),
  created_by: z.string().default("unknown-agent"),
});

export const addRuleTool = {
  name: "add_rule",
  description: `Record an always-apply rule for specific file patterns.

Rules are directives that should always be followed when working with files matching
the applies_to glob patterns. They surface automatically via get_context and recall
when matching files are queried.

Examples of applies_to patterns:
- "src/api/**" — matches all files under src/api/
- "*.config.ts" — matches all TypeScript config files
- "src/db/*.ts" — matches TypeScript files directly in src/db/

Scopes:
- project: Specific to current project only
- cross-project: Shared across related projects
- global: Universal knowledge applicable everywhere`,
  inputSchema: zodToJsonSchema(AddRuleInputSchema),
};

export function handleAddRule(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = AddRuleInputSchema.parse(args);

  const learning = repo.add({
    title: input.title,
    content: input.content,
    type: "rule",
    scope: input.scope,
    project_path: input.project_path,
    tags: input.tags,
    file_references: input.file_references,
    related_ids: input.related_ids,
    confidence: input.confidence,
    created_by: input.created_by,
    applies_to: input.applies_to,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            id: learning.id,
            applies_to: input.applies_to,
            message: `Rule "${learning.title}" added successfully`,
          },
          null,
          2
        ),
      },
    ],
  };
}
