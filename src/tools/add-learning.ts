import { z } from "zod";
import type { LearningRepository } from "../db/repository.js";
import { AddLearningInputSchema } from "../types.js";

export const addLearningTool = {
  name: "add_learning",
  description: `Record a new learning, pattern, gotcha, or insight.

Types:
- gotcha: Unexpected behavior or common mistake
- pattern: Best practice or recommended approach
- investigation: Debugging steps or root cause analysis
- documentation: API docs, architecture notes
- tip: Quick shortcut or useful trick
- suggestion: Codebase improvement idea (prefer add_suggestion for richer categorization)
- rule: Always-apply directive for specific file patterns (prefer add_rule for rules)

Scopes:
- project: Specific to current project only
- cross-project: Shared across related projects
- global: Universal knowledge applicable everywhere`,
  inputSchema: zodToJsonSchema(AddLearningInputSchema),
};

export function handleAddLearning(
  repo: LearningRepository,
  args: unknown
): { content: Array<{ type: "text"; text: string }> } {
  const input = AddLearningInputSchema.parse(args);
  const learning = repo.add(input);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            id: learning.id,
            message: `Learning "${learning.title}" added successfully`,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Helper to convert Zod schema to JSON Schema for MCP
function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): object {
  const shape = schema.shape;
  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = zodTypeToJsonSchema(zodType);

    // Check if required (not optional and no default)
    if (
      !zodType.isOptional() &&
      !(zodType._def as { defaultValue?: unknown }).defaultValue
    ) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): object {
  const def = zodType._def;

  // Handle optional
  if (def.typeName === "ZodOptional") {
    return zodTypeToJsonSchema(def.innerType);
  }

  // Handle nullable
  if (def.typeName === "ZodNullable") {
    return zodTypeToJsonSchema(def.innerType);
  }

  // Handle default
  if (def.typeName === "ZodDefault") {
    return zodTypeToJsonSchema(def.innerType);
  }

  // Handle enum
  if (def.typeName === "ZodEnum") {
    return {
      type: "string",
      enum: def.values,
    };
  }

  // Handle array
  if (def.typeName === "ZodArray") {
    return {
      type: "array",
      items: zodTypeToJsonSchema(def.type),
    };
  }

  // Handle string
  if (def.typeName === "ZodString") {
    const result: Record<string, unknown> = { type: "string" };
    for (const check of def.checks || []) {
      if (check.kind === "min") result.minLength = check.value;
      if (check.kind === "max") result.maxLength = check.value;
      if (check.kind === "uuid") result.format = "uuid";
    }
    return result;
  }

  // Handle number
  if (def.typeName === "ZodNumber") {
    const result: Record<string, unknown> = { type: "number" };
    for (const check of def.checks || []) {
      if (check.kind === "int") result.type = "integer";
      if (check.kind === "min") result.minimum = check.value;
      if (check.kind === "max") result.maximum = check.value;
    }
    return result;
  }

  // Handle boolean
  if (def.typeName === "ZodBoolean") {
    return { type: "boolean" };
  }

  // Handle object
  if (def.typeName === "ZodObject") {
    return zodToJsonSchema(zodType as z.ZodObject<z.ZodRawShape>);
  }

  // Fallback
  return { type: "string" };
}

export { zodToJsonSchema };
