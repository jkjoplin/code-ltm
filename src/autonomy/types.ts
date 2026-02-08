import type { Confidence, LearningType } from "../types.js";

export interface AutonomyCandidate {
  source: "git" | "tests" | "pr" | "maintenance";
  title: string;
  content: string;
  type: LearningType;
  confidence: Confidence;
  tags: string[];
  file_references: Array<{ path: string }>;
  project_path?: string;
}

export interface NormalizedAutonomyCandidate extends AutonomyCandidate {
  fingerprint: string;
}

export interface AutonomyRunResult {
  run_id: string;
  status: "success" | "partial" | "failed";
  dry_run: boolean;
  maintenance: boolean;
  collected_count: number;
  inserted_count: number;
  skipped_count: number;
  notes: string[];
}
