import { execSync } from "node:child_process";
import path from "node:path";
import type { AutonomyCandidate } from "./types.js";

function safeExec(command: string, cwd: string): string {
  try {
    return execSync(command, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function collectGitCandidates(projectPath: string): AutonomyCandidate[] {
  const cwd = path.resolve(projectPath);
  const changedFiles = safeExec("git diff --name-only HEAD~1 HEAD", cwd)
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const commitMessage = safeExec("git log -1 --pretty=%B", cwd);

  if (changedFiles.length === 0 && !commitMessage) {
    return [];
  }

  const tags = ["autonomy", "git", "change"];
  const commitLower = commitMessage.toLowerCase();
  let type: AutonomyCandidate["type"] = "documentation";
  let confidence: AutonomyCandidate["confidence"] = "medium";

  if (/\bfix\b|\bbug\b|\bhotfix\b|\bregression\b/.test(commitLower)) {
    type = "gotcha";
    confidence = "high";
    tags.push("fix");
  } else if (/\brefactor\b|\bcleanup\b/.test(commitLower)) {
    type = "pattern";
    tags.push("refactor");
  }

  return [
    {
      source: "git",
      title: `Recent code change context${commitMessage ? `: ${commitMessage.slice(0, 64)}` : ""}`,
      content: `Latest commit summary:\n${commitMessage || "(no message)"}\n\nChanged files:\n${changedFiles
        .map((file) => `- ${file}`)
        .join("\n")}`,
      type,
      confidence,
      tags,
      file_references: changedFiles.map((file) => ({ path: file })),
      project_path: cwd,
    },
  ];
}
