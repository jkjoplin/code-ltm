import express from "express";
import cors from "cors";
import { createDatabase } from "../db/schema.js";
import { LearningRepository } from "../db/repository.js";
import { learningsRouter } from "./routes/learnings.js";
import { graphRouter } from "./routes/graph.js";
import { autonomyRouter } from "./routes/autonomy.js";
import { errorHandler } from "./middleware/error-handler.js";
import { EmbeddingService } from "../embeddings/index.js";
import { LearningSchema, AddLearningInputSchema } from "../types.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config/index.js";
import type { Request, Response, NextFunction } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Initialize database and repository
const db = createDatabase();
const repo = new LearningRepository(db);
const config = getConfig();
const journalMode = db.pragma("journal_mode", { simple: true });
const foreignKeys = db.pragma("foreign_keys", { simple: true });
console.log(
  `DB self-check: journal_mode=${String(journalMode)}, foreign_keys=${String(foreignKeys)}`
);

// Initialize embedding service (async)
(async () => {
  const embeddingService = new EmbeddingService(config.embeddings);
  await embeddingService.initialize();
  if (embeddingService.isAvailable()) {
    repo.setEmbeddingService(embeddingService);
    console.log(
      `Embedding self-check: available=true provider=${embeddingService.getActiveProvider()}`
    );
  } else {
    console.log("Embedding self-check: available=false provider=none");
  }
})();

// Routes
app.use("/api/learnings", learningsRouter(repo));
app.use("/api/graph", graphRouter(repo));
app.use("/api/autonomy", autonomyRouter(repo));

// GET /api/stats - Get embedding statistics
app.get("/api/stats", (_req, res) => {
  const stats = repo.getEmbeddingStats();
  const byType: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const types = [
    "gotcha",
    "pattern",
    "investigation",
    "documentation",
    "tip",
    "suggestion",
    "rule",
  ] as const;
  const scopes = ["project", "cross-project", "global"] as const;
  for (const type of types) {
    byType[type] = repo.list({ type, limit: 5000, offset: 0 }).length;
  }
  for (const scope of scopes) {
    byScope[scope] = repo.list({ scope, limit: 5000, offset: 0 }).length;
  }
  res.json({
    ...stats,
    byType,
    byScope,
    semantic_available: repo.isSemanticSearchAvailable(),
  });
});

// POST /api/export - Export all learnings as JSON
app.post("/api/export", (_req, res) => {
  const learnings: unknown[] = [];
  let offset = 0;
  const limit = 100;

  // Fetch all learnings in batches
  while (true) {
    const batch = repo.list({ limit, offset });
    if (batch.length === 0) break;

    for (const summary of batch) {
      const full = repo.get(summary.id);
      if (full) learnings.push(full);
    }

    offset += limit;
    if (batch.length < limit) break;
  }

  res.json({
    version: 1,
    exported_at: new Date().toISOString(),
    count: learnings.length,
    learnings,
  });
});

// POST /api/import - Import learnings from JSON
const ImportSchema = z.object({
  learnings: z.array(LearningSchema),
});

app.post("/api/import", (req, res) => {
  const { learnings } = ImportSchema.parse(req.body);

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];
  const idMap = new Map<string, string>();
  const relationSyncIds = new Set<string>();

  for (const learning of learnings) {
    // Check if already exists
    const existing = repo.get(learning.id);
    if (existing) {
      skipped++;
      idMap.set(learning.id, existing.id);
      continue;
    }

    try {
      const result = repo.upsert({
        id: learning.id,
        title: learning.title,
        content: learning.content,
        type: learning.type,
        scope: learning.scope,
        project_path: learning.project_path ?? null,
        tags: learning.tags,
        file_references: learning.file_references,
        related_ids: [],
        confidence: learning.confidence,
        created_by: learning.created_by,
        created_at: learning.created_at,
        updated_at: learning.updated_at,
        version: learning.version,
        deprecated: learning.deprecated ?? false,
        deprecated_reason: learning.deprecated_reason ?? null,
        deprecated_at: learning.deprecated_at ?? null,
        applies_to: learning.applies_to ?? null,
        if_exists: "error",
      });
      idMap.set(learning.id, result.learning.id);
      relationSyncIds.add(learning.id);
      imported++;
    } catch (err) {
      errors.push({
        id: learning.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  for (const learning of learnings) {
    if (!relationSyncIds.has(learning.id)) continue;
    const resolvedId = idMap.get(learning.id);
    if (!resolvedId) continue;

    const mappedRelated = learning.related_ids
      .map((id) => idMap.get(id))
      .filter((id): id is string => !!id);

    try {
      repo.upsert({
        id: resolvedId,
        title: learning.title,
        content: learning.content,
        type: learning.type,
        scope: learning.scope,
        project_path: learning.project_path ?? null,
        tags: learning.tags,
        file_references: learning.file_references,
        related_ids: mappedRelated,
        confidence: learning.confidence,
        created_by: learning.created_by,
        created_at: learning.created_at,
        updated_at: learning.updated_at,
        version: learning.version,
        deprecated: learning.deprecated ?? false,
        deprecated_reason: learning.deprecated_reason ?? null,
        deprecated_at: learning.deprecated_at ?? null,
        applies_to: learning.applies_to ?? null,
        if_exists: "update",
      });
    } catch (err) {
      errors.push({
        id: learning.id,
        error: err instanceof Error ? err.message : "Failed to restore relations",
      });
    }
  }

  res.json({
    imported,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    total: learnings.length,
  });
});

// GET /api/tags - Get all unique tags
app.get("/api/tags", (_req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT tag FROM learning_tags ORDER BY tag")
    .all() as { tag: string }[];
  res.json(rows.map((r) => r.tag));
});

// GET /api/projects - Get all unique project paths
app.get("/api/projects", (_req, res) => {
  const projects = repo.getProjects();
  res.json(projects);
});

// ==================== AGENT MARATHON ENDPOINTS ====================

// GET /api/hot - Top N most-accessed learnings
app.get("/api/hot", (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 10, 50));
  const projectPath = req.query.project_path as string | undefined;
  const results = repo.hotPaths({
    limit,
    project_path: projectPath,
  });
  res.json({ count: results.length, learnings: results });
});

// POST /api/batch_add - Batch add learnings
app.post(
  "/api/batch_add",
  asyncHandler(async (req, res) => {
    const { learnings: inputs } = z
      .object({ learnings: z.array(AddLearningInputSchema).min(1).max(50) })
      .parse(req.body);

    const ids: string[] = [];
    const titles: string[] = [];
    for (const input of inputs) {
      const learning = repo.add(input);
      ids.push(learning.id);
      titles.push(learning.title);
    }
    res.status(201).json({ added: ids.length, ids, titles });
  })
);

// GET /api/prune_candidates - Identify cleanup candidates
app.get("/api/prune_candidates", (req, res) => {
  const projectPath = req.query.project_path as string | undefined;
  const allCandidates = repo.getPruneCandidates(projectPath);
  const now = Date.now();
  const DAY_MS = 86400000;

  type PruneReason =
    | "low_quality"
    | "stale"
    | "never_accessed"
    | "low_confidence_tip";
  interface PruneCandidate {
    id: string;
    title: string;
    type: string;
    reason: PruneReason;
    details: string;
    created_at: string;
    last_accessed_at: string | null;
  }

  const seen = new Set<string>();
  const results: PruneCandidate[] = [];

  for (const c of allCandidates) {
    if (c.dismissed_count > c.helpful_count && c.dismissed_count >= 2) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        results.push({
          id: c.id, title: c.title, type: c.type, reason: "low_quality",
          details: `dismissed ${c.dismissed_count}x vs helpful ${c.helpful_count}x`,
          created_at: c.created_at, last_accessed_at: c.last_accessed_at,
        });
      }
    }
  }
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    const ageDays = (now - new Date(c.created_at).getTime()) / DAY_MS;
    if (ageDays > 90 && c.access_count === 0 && c.type !== "rule") {
      seen.add(c.id);
      results.push({
        id: c.id, title: c.title, type: c.type, reason: "stale",
        details: `created ${Math.round(ageDays)} days ago, never accessed`,
        created_at: c.created_at, last_accessed_at: c.last_accessed_at,
      });
    }
  }
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    const ageDays = (now - new Date(c.created_at).getTime()) / DAY_MS;
    if (ageDays > 30 && c.access_count === 0 && c.type !== "rule" && c.type !== "pattern") {
      seen.add(c.id);
      results.push({
        id: c.id, title: c.title, type: c.type, reason: "never_accessed",
        details: `created ${Math.round(ageDays)} days ago, never accessed`,
        created_at: c.created_at, last_accessed_at: c.last_accessed_at,
      });
    }
  }
  for (const c of allCandidates) {
    if (seen.has(c.id)) continue;
    if (c.confidence === "low" && c.type === "tip" && c.access_count < 2) {
      seen.add(c.id);
      results.push({
        id: c.id, title: c.title, type: c.type, reason: "low_confidence_tip",
        details: `low confidence tip, accessed ${c.access_count}x`,
        created_at: c.created_at, last_accessed_at: c.last_accessed_at,
      });
    }
  }

  res.json({ count: results.length, candidates: results });
});

// POST /api/session_init - Initialize session for non-MCP agents
app.post(
  "/api/session_init",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        task: z.string().optional(),
        project_path: z.string(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const sessionId = uuidv4();
    repo.createSession(sessionId, input.project_path, input.task);

    // Rules
    const allRules = repo.list({ type: "rule", limit: 100, offset: 0, include_deprecated: false });
    const rulesWithContent = allRules.map((r) => {
      const full = repo.get(r.id, true);
      return full
        ? { id: full.id, title: full.title, content: full.content, scope: full.scope, applies_to: full.applies_to }
        : { id: r.id, title: r.title, content: "", scope: r.scope, applies_to: null };
    });

    // Hot
    const hot = repo.hotPaths({ limit: 5, project_path: input.project_path });

    // Relevant search
    let relevant: Array<{ id: string; title: string; type: string; confidence: string }> = [];
    if (input.task) {
      const searchResults = await repo.hybridSearch({
        query: input.task,
        project_path: input.project_path,
        limit: 10,
        mode: "hybrid",
        semantic_weight: 0.5,
      });
      relevant = searchResults.map((s) => ({
        id: s.id, title: s.title, type: s.type, confidence: s.confidence,
      }));
      if (searchResults.length > 0) {
        repo.recordAccess(searchResults.map((s) => s.id));
      }
    }

    res.status(201).json({ session_id: sessionId, rules: rulesWithContent, hot, relevant });
  })
);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export { app };
