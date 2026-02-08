import express from "express";
import cors from "cors";
import { createDatabase } from "../db/schema.js";
import { LearningRepository } from "../db/repository.js";
import { learningsRouter } from "./routes/learnings.js";
import { graphRouter } from "./routes/graph.js";
import { errorHandler } from "./middleware/error-handler.js";
import { EmbeddingService } from "../embeddings/index.js";
import { LearningSchema } from "../types.js";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Initialize database and repository
const db = createDatabase();
const repo = new LearningRepository(db);

// Initialize embedding service (async)
(async () => {
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();
  if (embeddingService.isAvailable()) {
    repo.setEmbeddingService(embeddingService);
    console.log("Embedding service initialized");
  } else {
    console.log("Embedding service not available (no API key configured)");
  }
})();

// Routes
app.use("/api/learnings", learningsRouter(repo));
app.use("/api/graph", graphRouter(repo));

// GET /api/stats - Get embedding statistics
app.get("/api/stats", (_req, res) => {
  const stats = repo.getEmbeddingStats();
  res.json({
    ...stats,
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

  for (const learning of learnings) {
    // Check if already exists
    const existing = repo.get(learning.id);
    if (existing) {
      skipped++;
      continue;
    }

    try {
      repo.add({
        title: learning.title,
        content: learning.content,
        type: learning.type,
        scope: learning.scope,
        project_path: learning.project_path,
        tags: learning.tags,
        file_references: learning.file_references,
        related_ids: learning.related_ids,
        confidence: learning.confidence,
        created_by: learning.created_by,
      });
      imported++;
    } catch (err) {
      errors.push({
        id: learning.id,
        error: err instanceof Error ? err.message : "Unknown error",
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
