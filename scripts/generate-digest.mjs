#!/usr/bin/env node

import Database from "better-sqlite3";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Parse args
const args = process.argv.slice(2);
let projectPath = null;
let dryRun = false;
let outputFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--project" && args[i + 1]) {
    projectPath = args[++i];
  } else if (args[i] === "--dry-run") {
    dryRun = true;
  } else if ((args[i] === "-o" || args[i] === "--output") && args[i + 1]) {
    outputFile = args[++i];
  }
}

// Connect to DB
const dbPath = process.env.CODE_LTM_DB || join(homedir(), ".code-ltm", "knowledge.db");
if (!existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  console.error("Set CODE_LTM_DB env var or ensure ~/.code-ltm/knowledge.db exists.");
  if (dryRun) {
    outputDigest([], [], [], projectPath, dryRun, outputFile);
    process.exit(0);
  }
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const projectCondition = projectPath
  ? "AND (project_path IS NULL OR project_path = ?)"
  : "";
const projectParams = projectPath ? [projectPath] : [];

// 1. Rules (always)
const rules = db
  .prepare(
    `SELECT id, title, content, type, scope, confidence
     FROM learnings
     WHERE deprecated = 0 AND type = 'rule' ${projectCondition}
     ORDER BY created_at DESC`
  )
  .all(...projectParams);

// 2. Hot learnings (access_count > 0, not rules)
const hot = db
  .prepare(
    `SELECT l.id, l.title, l.content, l.type, l.scope, l.confidence, l.access_count,
            COALESCE(qm.usefulness_score, 0.5) as usefulness_score
     FROM learnings l
     LEFT JOIN learning_quality_metrics qm ON l.id = qm.learning_id
     WHERE l.deprecated = 0 AND l.type != 'rule' AND l.access_count > 0 ${projectCondition}
     ORDER BY (l.access_count * COALESCE(qm.usefulness_score, 0.5)) DESC
     LIMIT 30`
  )
  .all(...projectParams);

// 3. Recent learnings (last 7 days, not rules, not already in hot)
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
const recent = db
  .prepare(
    `SELECT id, title, content, type, scope, confidence
     FROM learnings
     WHERE deprecated = 0 AND type != 'rule' AND created_at >= ? ${projectCondition}
     ORDER BY created_at DESC
     LIMIT 30`
  )
  .all(sevenDaysAgo, ...projectParams);

db.close();

outputDigest(rules, hot, recent, projectPath, dryRun, outputFile);

function outputDigest(rules, hot, recent, projectPath, dryRun, outputFile) {
  const seen = new Set();
  const lines = [
    "# Agent Knowledge Digest",
    `Generated: ${new Date().toISOString()} | Project: ${projectPath || "all"}`,
    "",
    "---",
    "",
  ];

  // Rules section (always)
  if (rules.length > 0) {
    lines.push("## Rules", "");
    for (const r of rules) {
      seen.add(r.id);
      lines.push(`- **${r.title}**: ${r.content}`);
    }
    lines.push("");
  }

  // Hot learnings section
  const hotUnseen = hot.filter((h) => !seen.has(h.id));
  if (hotUnseen.length > 0) {
    lines.push("## Battle-Tested Knowledge", "");
    for (const h of hotUnseen) {
      seen.add(h.id);
      lines.push(`- **${h.title}** (${h.type}, ${h.access_count} accesses): ${h.content}`);
    }
    lines.push("");
  }

  // Recent learnings section
  const recentUnseen = recent.filter((r) => !seen.has(r.id));
  if (recentUnseen.length > 0) {
    lines.push("## Recent Learnings (last 7 days)", "");
    for (const r of recentUnseen) {
      seen.add(r.id);
      lines.push(`- **${r.title}** (${r.type}): ${r.content}`);
    }
    lines.push("");
  }

  if (seen.size === 0) {
    lines.push("_No learnings yet. Use `add_learning` to start building your knowledge base._", "");
  }

  const totalCount = seen.size;
  lines[1] = `Generated: ${new Date().toISOString()} | ${totalCount} learnings | Project: ${projectPath || "all"}`;

  const output = lines.join("\n");

  if (dryRun) {
    process.stdout.write(output);
  } else {
    const outPath = outputFile || join(homedir(), ".agents-digest.md");
    writeFileSync(outPath, output, "utf-8");
    console.log(`Digest written to ${outPath} (${totalCount} learnings)`);
  }
}
