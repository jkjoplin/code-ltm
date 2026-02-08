import fs from "node:fs";
import path from "node:path";
import type { AutonomyCandidate } from "./types.js";

const DEFAULT_PR_NOTES_PATH = ".code-ltm/autonomy/pr-notes.md";

export function collectPrCandidates(projectPath: string): AutonomyCandidate[] {
  const cwd = path.resolve(projectPath);
  const notesPath = path.join(cwd, DEFAULT_PR_NOTES_PATH);
  if (!fs.existsSync(notesPath)) return [];

  const notes = fs.readFileSync(notesPath, "utf8").trim();
  if (!notes) return [];

  const confidence =
    /\bmust\b|\brequired\b|\bblocker\b/i.test(notes) ? "high" : "medium";
  const type: AutonomyCandidate["type"] = /\bsuggest\b|\bconsider\b/i.test(notes)
    ? "suggestion"
    : "documentation";

  return [
    {
      source: "pr",
      title: "PR review guidance captured",
      content: `Captured PR notes from ${DEFAULT_PR_NOTES_PATH}:\n\n${notes.slice(0, 3000)}`,
      type,
      confidence,
      tags: ["autonomy", "pr", "review"],
      file_references: [],
      project_path: cwd,
    },
  ];
}
