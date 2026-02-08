import type { LearningRepository } from "../db/repository.js";
import type { NormalizedAutonomyCandidate } from "./types.js";

export interface CandidateWriteResult {
  inserted: boolean;
  learningId?: string;
  reason?: string;
}

export function writeCandidate(
  repo: LearningRepository,
  runId: string,
  candidate: NormalizedAutonomyCandidate,
  dryRun: boolean
): CandidateWriteResult {
  if (
    candidate.confidence === "low" &&
    candidate.file_references.length === 0 &&
    !candidate.tags.includes("needs-validation")
  ) {
    repo.recordAutonomyCandidate({
      run_id: runId,
      source: candidate.source,
      fingerprint: candidate.fingerprint,
      decision: "skipped_low_confidence",
      payload_json: JSON.stringify(candidate),
      reason: "Low-confidence candidate without concrete file references",
    });
    return {
      inserted: false,
      reason: "low_confidence_without_file_refs",
    };
  }

  if (dryRun) {
    repo.recordAutonomyCandidate({
      run_id: runId,
      source: candidate.source,
      fingerprint: candidate.fingerprint,
      decision: "suggested",
      payload_json: JSON.stringify(candidate),
      reason: "Dry run",
    });
    return { inserted: false, reason: "dry_run" };
  }

  const upsertResult = repo.upsert(
    {
      title: candidate.title,
      content: candidate.content,
      type: candidate.type,
      scope: "project",
      project_path: candidate.project_path ?? null,
      tags: candidate.tags,
      file_references: candidate.file_references,
      related_ids: [],
      confidence: candidate.confidence,
      created_by: "autonomy",
      if_exists: "skip",
    },
    "autonomy"
  );

  repo.recordAutonomyCandidate({
    run_id: runId,
    source: candidate.source,
    fingerprint: candidate.fingerprint,
    decision: upsertResult.skipped ? "skipped_duplicate" : "inserted",
    learning_id: upsertResult.learning.id,
    payload_json: JSON.stringify(candidate),
    reason: upsertResult.skipped ? "Existing matching learning" : undefined,
  });

  return {
    inserted: !upsertResult.skipped,
    learningId: upsertResult.learning.id,
    reason: upsertResult.skipped ? "duplicate" : undefined,
  };
}
