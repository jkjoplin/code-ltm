import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { LearningRepository } from "../db/repository.js";
import type {
  AutonomySource,
  RunAutonomyCycleInput,
  Learning,
} from "../types.js";
import { collectGitCandidates } from "./collector-git.js";
import { collectPrCandidates } from "./collector-pr.js";
import { collectTestCandidates } from "./collector-tests.js";
import { isCandidateDuplicate } from "./dedupe.js";
import { normalizeCandidate } from "./normalizer.js";
import type { AutonomyCandidate, AutonomyRunResult } from "./types.js";
import { writeCandidate } from "./writer.js";

function getProjectPath(inputPath?: string): string {
  return path.resolve(inputPath ?? process.cwd());
}

function normalizeLearningText(learning: Learning): string {
  return `${learning.title}\n${learning.content}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildMaintenanceCandidates(
  repo: LearningRepository,
  projectPath: string
): AutonomyCandidate[] {
  const summaries = repo.list({
    project_path: projectPath,
    limit: 2000,
    offset: 0,
    include_deprecated: false,
  });
  const learnings = summaries
    .map((summary) => repo.get(summary.id))
    .filter((learning): learning is Learning => !!learning);

  const candidates: AutonomyCandidate[] = [];
  const normalizedMap = new Map<string, Learning[]>();

  for (const learning of learnings) {
    const normalized = normalizeLearningText(learning);
    const existing = normalizedMap.get(normalized) ?? [];
    existing.push(learning);
    normalizedMap.set(normalized, existing);
  }

  for (const [normalized, duplicates] of normalizedMap) {
    if (duplicates.length < 2) continue;
    const topIds = duplicates.slice(0, 5).map((l) => l.id.slice(0, 8));
    candidates.push({
      source: "maintenance",
      title: "Duplicate learning cluster detected",
      content: `Potential duplicate learnings detected (${duplicates.length}).\n` +
        `Representative text: ${normalized.slice(0, 240)}\n` +
        `IDs: ${topIds.join(", ")}`,
      type: "suggestion",
      confidence: "high",
      tags: ["maintenance", "duplicate", "review"],
      file_references: [],
      project_path: projectPath,
    });
  }

  const byTitle = new Map<string, Learning[]>();
  for (const learning of learnings) {
    const key = learning.title.toLowerCase().trim();
    const group = byTitle.get(key) ?? [];
    group.push(learning);
    byTitle.set(key, group);
  }
  for (const [title, group] of byTitle) {
    if (group.length < 2) continue;
    const hasAlways = group.some((item) => /\balways\b/i.test(item.content));
    const hasNever = group.some((item) => /\bnever\b/i.test(item.content));
    if (!hasAlways || !hasNever) continue;

    candidates.push({
      source: "maintenance",
      title: "Potential contradictory guidance detected",
      content: `The learning title "${title}" has conflicting language ("always" and "never"). Review linked entries before agents consume both.`,
      type: "investigation",
      confidence: "medium",
      tags: ["maintenance", "conflict", "review"],
      file_references: [],
      project_path: projectPath,
    });
  }

  const now = Date.now();
  for (const learning of learnings) {
    const ageDays =
      (now - new Date(learning.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 180 && learning.access_count < 2) {
      candidates.push({
        source: "maintenance",
        title: "Staleness review candidate",
        content: `Learning "${learning.title}" has low usage (${learning.access_count}) and has not been updated in ${Math.floor(ageDays)} days. Consider deprecating or refreshing.`,
        type: "suggestion",
        confidence: "medium",
        tags: ["maintenance", "stale", "deprecation"],
        file_references: learning.file_references.map((fileRef) => ({
          path: fileRef.path,
        })),
        project_path: projectPath,
      });
    }

    if (learning.scope === "project" && learning.confidence === "high" && learning.access_count >= 5) {
      candidates.push({
        source: "maintenance",
        title: "Promotion suggestion: project to cross-project",
        content: `Learning "${learning.title}" has high confidence and frequent usage (${learning.access_count} accesses). Consider promoting to cross-project scope.`,
        type: "suggestion",
        confidence: "medium",
        tags: ["maintenance", "promotion", "scope"],
        file_references: [],
        project_path: projectPath,
      });
    }

    if (
      learning.scope === "cross-project" &&
      learning.confidence === "high" &&
      learning.access_count >= 10
    ) {
      candidates.push({
        source: "maintenance",
        title: "Promotion suggestion: cross-project to global",
        content: `Learning "${learning.title}" has high confidence and strong reuse (${learning.access_count} accesses). Consider global promotion after human review.`,
        type: "suggestion",
        confidence: "medium",
        tags: ["maintenance", "promotion", "global-review-required"],
        file_references: [],
        project_path: projectPath,
      });
    }
  }

  return candidates;
}

function collectBySource(
  source: AutonomySource,
  projectPath: string
): AutonomyCandidate[] {
  switch (source) {
    case "git":
      return collectGitCandidates(projectPath);
    case "tests":
      return collectTestCandidates(projectPath);
    case "pr":
      return collectPrCandidates(projectPath);
    default:
      return [];
  }
}

export async function runAutonomyCycle(
  repo: LearningRepository,
  input: RunAutonomyCycleInput
): Promise<AutonomyRunResult> {
  const projectPath = getProjectPath(input.project_path);
  const startedAt = new Date().toISOString();
  const runId = uuidv4();
  const notes: string[] = [];

  const collectedCandidates: AutonomyCandidate[] = [];
  for (const source of input.sources) {
    const sourceCandidates = collectBySource(source, projectPath);
    collectedCandidates.push(...sourceCandidates);
  }

  if (input.maintenance) {
    collectedCandidates.push(...buildMaintenanceCandidates(repo, projectPath));
  }

  let inserted = 0;
  let skipped = 0;
  let status: AutonomyRunResult["status"] = "success";

  for (const candidate of collectedCandidates) {
    try {
      const normalized = normalizeCandidate(candidate);

      if (isCandidateDuplicate(repo, normalized)) {
        skipped++;
        repo.recordAutonomyCandidate({
          run_id: runId,
          source: normalized.source,
          fingerprint: normalized.fingerprint,
          decision: "skipped_duplicate",
          payload_json: JSON.stringify(normalized),
          reason: "Duplicate fingerprint or equivalent title already exists",
        });
        continue;
      }

      const writeResult = writeCandidate(repo, runId, normalized, input.dry_run);
      if (writeResult.inserted) {
        inserted++;
      } else {
        skipped++;
        if (writeResult.reason) {
          notes.push(`${normalized.title}: ${writeResult.reason}`);
        }
      }
    } catch (error) {
      status = "partial";
      skipped++;
      notes.push(
        `candidate_error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (collectedCandidates.length === 0) {
    notes.push("No autonomy signals found");
  }

  if (notes.length > 0 && inserted === 0 && !input.dry_run) {
    status = "partial";
  }

  const finishedAt = new Date().toISOString();
  repo.createAutonomyRun({
    id: runId,
    project_path: projectPath,
    sources: input.sources,
    maintenance: input.maintenance,
    dry_run: input.dry_run,
    status,
    collected_count: collectedCandidates.length,
    inserted_count: inserted,
    skipped_count: skipped,
    notes: notes.slice(0, 20).join(" | "),
    started_at: startedAt,
    finished_at: finishedAt,
  });

  return {
    run_id: runId,
    status,
    dry_run: input.dry_run,
    maintenance: input.maintenance,
    collected_count: collectedCandidates.length,
    inserted_count: inserted,
    skipped_count: skipped,
    notes,
  };
}
