import { createHash } from "node:crypto";
import type {
  AutonomyCandidate,
  NormalizedAutonomyCandidate,
} from "./types.js";

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeCandidate(
  candidate: AutonomyCandidate
): NormalizedAutonomyCandidate {
  const normalizedPayload = [
    candidate.source,
    normalizeText(candidate.title),
    normalizeText(candidate.content),
    candidate.type,
    candidate.project_path ?? "",
    candidate.file_references
      .map((r) => r.path)
      .sort()
      .join(","),
  ].join("|");
  const fingerprint = createHash("sha256")
    .update(normalizedPayload)
    .digest("hex");

  return {
    ...candidate,
    title: candidate.title.trim(),
    content: candidate.content.trim(),
    tags: [...new Set(candidate.tags.map((tag) => tag.trim()).filter(Boolean))],
    fingerprint,
  };
}
