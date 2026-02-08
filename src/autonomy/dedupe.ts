import type { LearningRepository } from "../db/repository.js";
import type { NormalizedAutonomyCandidate } from "./types.js";

export function isCandidateDuplicate(
  repo: LearningRepository,
  candidate: NormalizedAutonomyCandidate
): boolean {
  if (repo.isAutonomyFingerprintSeen(candidate.fingerprint)) {
    return true;
  }

  let similarTitle: ReturnType<LearningRepository["search"]> = [];
  try {
    similarTitle = repo.search({
      query: candidate.title,
      limit: 10,
      include_deprecated: false,
    });
  } catch {
    return false;
  }

  return similarTitle.some(
    (row) => row.title.toLowerCase().trim() === candidate.title.toLowerCase().trim()
  );
}
