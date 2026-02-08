import fs from "node:fs";
import path from "node:path";
import type { AutonomyCandidate } from "./types.js";

const DEFAULT_TEST_LOG_PATH = ".code-ltm/autonomy/last-test-output.log";

function extractFileRefs(content: string): string[] {
  const matches = content.match(/[A-Za-z0-9_\-/]+\.(ts|tsx|js|jsx|py|go|rb|java):\d+/g) ?? [];
  return [...new Set(matches.map((match) => match.split(":")[0] ?? match))];
}

export function collectTestCandidates(projectPath: string): AutonomyCandidate[] {
  const cwd = path.resolve(projectPath);
  const explicitPath = process.env.CODE_LTM_TEST_OUTPUT_FILE;
  const testLogPath = explicitPath
    ? path.resolve(explicitPath)
    : path.join(cwd, DEFAULT_TEST_LOG_PATH);

  if (!fs.existsSync(testLogPath)) return [];

  const output = fs.readFileSync(testLogPath, "utf8");
  if (!/\b(fail|failed|error|assertion)\b/i.test(output)) {
    return [];
  }

  const fileRefs = extractFileRefs(output).map((file) => ({ path: file }));
  return [
    {
      source: "tests",
      title: "Recurring test failure signal",
      content: `Detected failing test output from ${testLogPath}.\n\n` +
        output.slice(0, 2000),
      type: "investigation",
      confidence: /re-run|repro|deterministic/i.test(output) ? "high" : "medium",
      tags: ["autonomy", "tests", "failure"],
      file_references: fileRefs,
      project_path: cwd,
    },
  ];
}
