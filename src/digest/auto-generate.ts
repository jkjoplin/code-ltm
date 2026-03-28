import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { LearningRepository } from "../db/repository.js";

/**
 * Generates ~/.agents-digest.md with rules (always), hot learnings (access_count > 0),
 * and recent learnings (last 7 days).
 */
export function generateAgentsDigest(repo: LearningRepository): string {
  const outputPath = path.join(os.homedir(), ".agents-digest.md");

  // 1. Rules (always included)
  const rules = repo.list({ type: "rule", limit: 200, offset: 0, include_deprecated: false });
  const ruleLearnings = rules.map((r) => repo.get(r.id)).filter(Boolean);

  // 2. Hot learnings (access_count > 0)
  const hot = repo.hotPaths({ limit: 50 });
  const hotFiltered = hot.filter((h) => h.access_count > 0);

  // 3. Recent learnings (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const allRecent = repo.list({ limit: 200, offset: 0, include_deprecated: false });
  const recentLearnings = allRecent
    .filter((l) => l.created_at >= sevenDaysAgo && l.type !== "rule")
    .map((l) => repo.get(l.id))
    .filter(Boolean);

  // Deduplicate: collect IDs we've already included
  const seen = new Set<string>();
  const lines: string[] = [
    "# Agent Knowledge Digest",
    `Generated: ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ];

  // Rules section
  if (ruleLearnings.length > 0) {
    lines.push("## Rules", "");
    for (const r of ruleLearnings) {
      if (!r) continue;
      seen.add(r.id);
      lines.push(`- **${r.title}**: ${r.content}`);
    }
    lines.push("");
  }

  // Hot learnings section
  const hotUnseen = hotFiltered.filter((h) => !seen.has(h.id));
  if (hotUnseen.length > 0) {
    lines.push("## Battle-Tested Knowledge", "");
    for (const h of hotUnseen) {
      seen.add(h.id);
      const full = repo.get(h.id);
      const content = full ? full.content : h.title;
      lines.push(`- **${h.title}** (${h.type}, ${h.access_count} accesses): ${content}`);
    }
    lines.push("");
  }

  // Recent learnings section
  const recentUnseen = recentLearnings.filter((l) => l && !seen.has(l.id));
  if (recentUnseen.length > 0) {
    lines.push("## Recent Learnings (last 7 days)", "");
    for (const l of recentUnseen) {
      if (!l) continue;
      seen.add(l.id);
      lines.push(`- **${l.title}** (${l.type}): ${l.content}`);
    }
    lines.push("");
  }

  if (seen.size === 0) {
    lines.push("_No learnings yet. Use `add_learning` to start building your knowledge base._", "");
  }

  const output = lines.join("\n");
  fs.writeFileSync(outputPath, output, "utf-8");
  return outputPath;
}
