import { z } from "zod";

// Enums
export const LearningTypeSchema = z.enum([
  "gotcha",
  "pattern",
  "investigation",
  "documentation",
  "tip",
]);
export type LearningType = z.infer<typeof LearningTypeSchema>;

export const ScopeSchema = z.enum(["project", "cross-project", "global"]);
export type Scope = z.infer<typeof ScopeSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const SearchModeSchema = z.enum(["keyword", "semantic", "hybrid"]);
export type SearchMode = z.infer<typeof SearchModeSchema>;

// File reference
export const FileRefSchema = z.object({
  path: z.string().min(1),
  line_start: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
  snippet: z.string().optional(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

// Learning entry
export const LearningSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  project_path: z.string().optional(),
  tags: z.array(z.string()),
  file_references: z.array(FileRefSchema),
  related_ids: z.array(z.string().uuid()),
  confidence: ConfidenceSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string(),
  version: z.number().int().positive(),
});
export type Learning = z.infer<typeof LearningSchema>;

// Input schemas for tools
export const AddLearningInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  project_path: z.string().optional(),
  tags: z.array(z.string()).default([]),
  file_references: z.array(FileRefSchema).default([]),
  related_ids: z.array(z.string().uuid()).default([]),
  confidence: ConfidenceSchema.default("medium"),
  created_by: z.string().default("unknown-agent"),
});
export type AddLearningInput = z.infer<typeof AddLearningInputSchema>;

export const UpdateLearningInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  type: LearningTypeSchema.optional(),
  scope: ScopeSchema.optional(),
  project_path: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  file_references: z.array(FileRefSchema).optional(),
  related_ids: z.array(z.string().uuid()).optional(),
  confidence: ConfidenceSchema.optional(),
});
export type UpdateLearningInput = z.infer<typeof UpdateLearningInputSchema>;

export const ListLearningsInputSchema = z.object({
  scope: ScopeSchema.optional(),
  type: LearningTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  project_path: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type ListLearningsInput = z.infer<typeof ListLearningsInputSchema>;

export const SearchLearningsInputSchema = z.object({
  query: z.string().min(1),
  scope: ScopeSchema.optional(),
  type: LearningTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  project_path: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  include_content: z.boolean().default(false),
  mode: SearchModeSchema.default("hybrid"),
  semantic_weight: z.number().min(0).max(1).default(0.5),
});
export type SearchLearningsInput = z.infer<typeof SearchLearningsInputSchema>;

export const ReembedLearningsInputSchema = z.object({
  force: z.boolean().default(false),
  batch_size: z.number().int().positive().max(100).default(10),
});
export type ReembedLearningsInput = z.infer<typeof ReembedLearningsInputSchema>;

export const LinkLearningsInputSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
});
export type LinkLearningsInput = z.infer<typeof LinkLearningsInputSchema>;

// Summary type for search results
export const LearningSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  tags: z.array(z.string()),
  confidence: ConfidenceSchema,
  created_at: z.string().datetime(),
  relevance_score: z.number().optional(),
});
export type LearningSummary = z.infer<typeof LearningSummarySchema>;

// Version history types
export const ChangeTypeSchema = z.enum(["create", "update", "delete"]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const LearningVersionSchema = z.object({
  id: z.number().int().positive(),
  learning_id: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  project_path: z.string().nullable(),
  confidence: ConfidenceSchema,
  tags: z.array(z.string()),
  file_references: z.array(FileRefSchema),
  related_ids: z.array(z.string().uuid()),
  changed_at: z.string().datetime(),
  changed_by: z.string(),
  change_type: ChangeTypeSchema,
});
export type LearningVersion = z.infer<typeof LearningVersionSchema>;

// Similar learning type for conflict detection
export const SimilarLearningSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  similarity: z.number().min(0).max(1),
});
export type SimilarLearning = z.infer<typeof SimilarLearningSchema>;

// Promotion candidate type
export const PromotionCandidateSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: LearningTypeSchema,
  scope: ScopeSchema,
  project_path: z.string().optional(),
  created_at: z.string().datetime(),
  usage_count: z.number().int().nonnegative().optional(),
});
export type PromotionCandidate = z.infer<typeof PromotionCandidateSchema>;

// Graph types for relationship visualization
export const GraphNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: LearningTypeSchema,
  scope: ScopeSchema,
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  source: z.string().uuid(),
  target: z.string().uuid(),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const RelationshipGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
export type RelationshipGraph = z.infer<typeof RelationshipGraphSchema>;
