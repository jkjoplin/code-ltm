import express from "express";
import cors from "cors";
import { createDatabase } from "../db/schema.js";
import { LearningRepository } from "../db/repository.js";
import { learningsRouter } from "./routes/learnings.js";
import { graphRouter } from "./routes/graph.js";
import { autonomyRouter } from "./routes/autonomy.js";
import { errorHandler } from "./middleware/error-handler.js";
import { EmbeddingService } from "../embeddings/index.js";
import { LearningSchema } from "../types.js";
import { z } from "zod";
import { getConfig } from "../config/index.js";

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

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

export { app };
