import type { Scope, LearningType, Confidence } from "../types.js";

export type DigestFormat = "markdown" | "index" | "json";

export interface DigestOptions {
  scope?: Scope;
  type?: LearningType;
  tags?: string[];
  project_path?: string;
  min_confidence: Confidence;
  require_tag?: string;
  format: DigestFormat;
  max_chars: number;
  max_content_length: number;
  group_by_type: boolean;
  include_ids: boolean;
  include_metadata: boolean;
}

export interface DigestStats {
  total_matched: number;
  total_included: number;
  total_truncated: number;
  total_omitted: number;
  character_count: number;
  generated_at: string;
  filters_applied: Record<string, string>;
}

export interface DigestResult {
  output: string;
  stats: DigestStats;
}

export interface ScoredLearning {
  id: string;
  title: string;
  content: string;
  type: LearningType;
  scope: Scope;
  confidence: Confidence;
  tags: string[];
  created_at: string;
  score: number;
  access_count?: number;
}
