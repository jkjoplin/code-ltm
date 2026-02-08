import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import {
  ScopeSchema,
  ConfidenceSchema,
  FileRefSchema,
} from "../types.js";
import { zodToJsonSchema } from "./add-learning.js";

const SuggestionCategorySchema = z.enum([
  "optimization",
  "refactor",
  "architecture",
  "exploration",
  "feature",
]);

const AddSuggestionInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: SuggestionCategorySchema,
  scope: ScopeSchema,
  project_path: z.string().optional(),
  tags: z.array(z.string()).default([]),
  file_references: z.array(FileRefSchema).default([]),
  related_ids: z.array(z.string().uuid()).default([]),
  confidence: ConfidenceSchema.default("medium"),
  created_by: z.string().default("unknown-agent"),
});

export const addSuggestionTool = {
  name: "add_suggestion",
  description: `Record a codebase improvement suggestion or idea.

Categories:
- optimization: Performance or efficiency improvements
- refactor: Code simplification, pattern consolidation, DRY violations
- architecture: Structural improvements, better abstractions
- exploration: Areas needing further investigation
- feature: New feature ideas or capabilities

Scopes:
- project: Specific to current project only
- cross-project: Shared across related projects
- global: Universal knowledge applicable everywhere

Suggestions are stored as learnings with type "suggestion" and the category as a tag.
Use list_learnings with type: "suggestion" to retrieve them.`,
  inputSchema: zodToJsonSchema(AddSuggestionInputSchema),
};

export function handleAddSuggestion(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = AddSuggestionInputSchema.parse(args);

  // Merge category into tags, avoiding duplicates
  const tags = input.tags.includes(input.category)
    ? input.tags
    : [input.category, ...input.tags];

  const learning = repo.add({
    title: input.title,
    content: input.content,
    type: "suggestion",
    scope: input.scope,
    project_path: input.project_path,
    tags,
    file_references: input.file_references,
    related_ids: input.related_ids,
    confidence: input.confidence,
    created_by: input.created_by,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            id: learning.id,
            category: input.category,
            message: `Suggestion "${learning.title}" recorded successfully`,
          },
          null,
          2
        ),
      },
    ],
  };
}
