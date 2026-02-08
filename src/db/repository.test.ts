import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { LearningRepository } from "./repository.js";
import type { AddLearningInput } from "../types.js";

// Use in-memory database for tests
function createTestDb(): Database.Database {
  const db = new Database(":memory:");

  // Load sqlite-vec for vector search support
  sqliteVec.load(db);

  // Run migrations inline for test
  db.exec(`
    CREATE TABLE IF NOT EXISTS learnings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'investigation', 'documentation', 'tip', 'suggestion', 'rule')),
      scope TEXT NOT NULL CHECK (scope IN ('project', 'cross-project', 'global')),
      project_path TEXT,
      confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      deprecated INTEGER NOT NULL DEFAULT 0,
      deprecated_reason TEXT,
      deprecated_at TEXT,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TEXT,
      applies_to TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_tags (
      learning_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (learning_id, tag),
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS file_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learning_id TEXT NOT NULL,
      path TEXT NOT NULL,
      line_start INTEGER,
      line_end INTEGER,
      snippet TEXT,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_relations (
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      PRIMARY KEY (source_id, target_id),
      FOREIGN KEY (source_id) REFERENCES learnings(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
      title,
      content,
      content='learnings',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
      INSERT INTO learnings_fts(rowid, title, content)
      VALUES (NEW.rowid, NEW.title, NEW.content);
    END;

    CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
      INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
    END;

    CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
      INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
      INSERT INTO learnings_fts(rowid, title, content)
      VALUES (NEW.rowid, NEW.title, NEW.content);
    END;

    -- Vector embeddings table using sqlite-vec
    CREATE VIRTUAL TABLE IF NOT EXISTS learning_embeddings USING vec0(
      learning_id TEXT PRIMARY KEY,
      embedding float[768]
    );

    -- Metadata about embeddings for cache invalidation
    CREATE TABLE IF NOT EXISTS embedding_metadata (
      learning_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      embedded_at TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    -- Version history table for audit trail and rollback
    CREATE TABLE IF NOT EXISTS learning_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learning_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      scope TEXT NOT NULL,
      project_path TEXT,
      confidence TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      file_refs_json TEXT NOT NULL,
      related_ids_json TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learning_id TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('used', 'helpful', 'dismissed')),
      source TEXT NOT NULL CHECK (source IN ('agent', 'user', 'auto')),
      context TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS learning_quality_metrics (
      learning_id TEXT PRIMARY KEY,
      used_count INTEGER NOT NULL DEFAULT 0,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      dismissed_count INTEGER NOT NULL DEFAULT 0,
      usefulness_score REAL NOT NULL DEFAULT 0.5,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS autonomy_runs (
      id TEXT PRIMARY KEY,
      project_path TEXT,
      sources_json TEXT NOT NULL,
      maintenance INTEGER NOT NULL DEFAULT 0,
      dry_run INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      collected_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS autonomy_candidates (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      source TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      decision TEXT NOT NULL,
      learning_id TEXT,
      payload_json TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES autonomy_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE SET NULL
    );
  `);

  return db;
}

const sqliteAvailable = (() => {
  try {
    const probe = new Database(":memory:");
    probe.close();
    return true;
  } catch {
    return false;
  }
})();

const describeRepo = sqliteAvailable ? describe : describe.skip;

describeRepo("LearningRepository", () => {
  let db: Database.Database;
  let repo: LearningRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new LearningRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  const sampleInput: AddLearningInput = {
    title: "Test Learning",
    content: "This is test content for the learning",
    type: "pattern",
    scope: "global",
    tags: ["test", "sample"],
    file_references: [
      {
        path: "src/index.ts",
        line_start: 10,
        line_end: 20,
        snippet: "const foo = bar;",
      },
    ],
    related_ids: [],
    confidence: "high",
    created_by: "test-agent",
  };

  describe("add", () => {
    it("should create a new learning", () => {
      const learning = repo.add(sampleInput);

      expect(learning.id).toBeDefined();
      expect(learning.title).toBe("Test Learning");
      expect(learning.content).toBe("This is test content for the learning");
      expect(learning.type).toBe("pattern");
      expect(learning.scope).toBe("global");
      expect(learning.tags).toEqual(["test", "sample"]);
      expect(learning.file_references).toHaveLength(1);
      expect(learning.confidence).toBe("high");
      expect(learning.version).toBe(1);
    });

    it("should store tags correctly", () => {
      const learning = repo.add(sampleInput);
      const retrieved = repo.get(learning.id);

      expect(retrieved?.tags.sort()).toEqual(["sample", "test"]);
    });

    it("should store file references correctly", () => {
      const learning = repo.add(sampleInput);
      const retrieved = repo.get(learning.id);

      expect(retrieved?.file_references).toHaveLength(1);
      expect(retrieved?.file_references[0]).toEqual({
        path: "src/index.ts",
        line_start: 10,
        line_end: 20,
        snippet: "const foo = bar;",
      });
    });
  });

  describe("get", () => {
    it("should retrieve an existing learning", () => {
      const created = repo.add(sampleInput);
      const retrieved = repo.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe(created.title);
    });

    it("should return null for non-existent learning", () => {
      const result = repo.get("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update learning fields", () => {
      const created = repo.add(sampleInput);
      const updated = repo.update({
        id: created.id,
        title: "Updated Title",
        confidence: "low",
      });

      expect(updated?.title).toBe("Updated Title");
      expect(updated?.confidence).toBe("low");
      expect(updated?.content).toBe(created.content); // Unchanged
      expect(updated?.version).toBe(2);
    });

    it("should update tags", () => {
      const created = repo.add(sampleInput);
      const updated = repo.update({
        id: created.id,
        tags: ["new-tag"],
      });

      expect(updated?.tags).toEqual(["new-tag"]);
    });

    it("should return null for non-existent learning", () => {
      const result = repo.update({
        id: "00000000-0000-0000-0000-000000000000",
        title: "New Title",
      });
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete an existing learning", () => {
      const created = repo.add(sampleInput);
      const deleted = repo.delete(created.id);

      expect(deleted).toBe(true);
      expect(repo.get(created.id)).toBeNull();
    });

    it("should return false for non-existent learning", () => {
      const result = repo.delete("00000000-0000-0000-0000-000000000000");
      expect(result).toBe(false);
    });
  });

  describe("list", () => {
    it("should list all learnings", () => {
      repo.add(sampleInput);
      repo.add({ ...sampleInput, title: "Second Learning" });

      const result = repo.list({ limit: 20, offset: 0 });
      expect(result).toHaveLength(2);
    });

    it("should filter by scope", () => {
      repo.add(sampleInput);
      repo.add({ ...sampleInput, title: "Project Learning", scope: "project" });

      const result = repo.list({ scope: "global", limit: 20, offset: 0 });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Test Learning");
    });

    it("should filter by type", () => {
      repo.add(sampleInput);
      repo.add({ ...sampleInput, title: "Gotcha Learning", type: "gotcha" });

      const result = repo.list({ type: "pattern", limit: 20, offset: 0 });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Test Learning");
    });

    it("should filter by tags", () => {
      repo.add(sampleInput);
      repo.add({
        ...sampleInput,
        title: "Different Tags",
        tags: ["other", "tags"],
      });

      const result = repo.list({ tags: ["test"], limit: 20, offset: 0 });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Test Learning");
    });

    it("should support pagination", () => {
      for (let i = 0; i < 5; i++) {
        repo.add({ ...sampleInput, title: `Learning ${i}` });
      }

      const page1 = repo.list({ limit: 2, offset: 0 });
      const page2 = repo.list({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]?.title).not.toBe(page2[0]?.title);
    });
  });

  describe("search", () => {
    it("should find learnings by keyword", () => {
      repo.add(sampleInput);
      repo.add({
        ...sampleInput,
        title: "React Hooks",
        content: "How to use React hooks effectively",
      });

      const result = repo.search({ query: "React", limit: 20 });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("React Hooks");
    });

    it("should search in content", () => {
      repo.add(sampleInput);
      repo.add({
        ...sampleInput,
        title: "Database Tips",
        content: "SQLite is great for embedded databases",
      });

      const result = repo.search({ query: "SQLite", limit: 20 });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Database Tips");
    });

    it("should combine search with filters", () => {
      repo.add({
        ...sampleInput,
        title: "Global Pattern",
        content: "A global pattern",
        scope: "global",
      });
      repo.add({
        ...sampleInput,
        title: "Project Pattern",
        content: "A project pattern",
        scope: "project",
      });

      const result = repo.search({
        query: "pattern",
        scope: "project",
        limit: 20,
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe("Project Pattern");
    });
  });

  describe("linkLearnings", () => {
    it("should create bidirectional link", () => {
      const learning1 = repo.add(sampleInput);
      const learning2 = repo.add({ ...sampleInput, title: "Second Learning" });

      const success = repo.linkLearnings(learning1.id, learning2.id);
      expect(success).toBe(true);

      const retrieved1 = repo.get(learning1.id);
      const retrieved2 = repo.get(learning2.id);

      expect(retrieved1?.related_ids).toContain(learning2.id);
      expect(retrieved2?.related_ids).toContain(learning1.id);
    });

    it("should return false if learning not found", () => {
      const learning1 = repo.add(sampleInput);
      const success = repo.linkLearnings(
        learning1.id,
        "00000000-0000-0000-0000-000000000000"
      );
      expect(success).toBe(false);
    });
  });

  describe("upsert", () => {
    it("preserves explicit id and metadata for trusted imports", () => {
      const trustedId = "11111111-1111-4111-8111-111111111111";
      const trustedCreatedAt = "2024-01-01T00:00:00.000Z";
      const trustedUpdatedAt = "2024-01-02T00:00:00.000Z";

      const result = repo.upsert({
        id: trustedId,
        title: "Trusted Import",
        content: "Imported content",
        type: "documentation",
        scope: "project",
        project_path: "/tmp/test",
        tags: ["import"],
        file_references: [],
        related_ids: [],
        confidence: "high",
        created_by: "importer",
        created_at: trustedCreatedAt,
        updated_at: trustedUpdatedAt,
        version: 7,
        if_exists: "error",
      });

      expect(result.created).toBe(true);
      expect(result.learning.id).toBe(trustedId);
      expect(result.learning.created_at).toBe(trustedCreatedAt);
      expect(result.learning.updated_at).toBe(trustedUpdatedAt);
      expect(result.learning.version).toBe(7);
    });
  });

  describe("relation integrity", () => {
    it("removes stale reverse links when related_ids are replaced", () => {
      const a = repo.add({ ...sampleInput, title: "A" });
      const b = repo.add({ ...sampleInput, title: "B" });
      const c = repo.add({ ...sampleInput, title: "C" });

      repo.update({ id: a.id, related_ids: [b.id] });
      repo.update({ id: a.id, related_ids: [c.id] });

      const updatedB = repo.get(b.id);
      const updatedC = repo.get(c.id);
      expect(updatedB?.related_ids.includes(a.id)).toBe(false);
      expect(updatedC?.related_ids).toContain(a.id);
    });
  });

  describe("feedback metrics", () => {
    it("updates quality metrics from feedback events", () => {
      const learning = repo.add(sampleInput);
      const metrics1 = repo.recordFeedback(learning.id, "used", "agent");
      const metrics2 = repo.recordFeedback(learning.id, "helpful", "user");
      const metrics3 = repo.recordFeedback(learning.id, "dismissed", "auto");

      expect(metrics1?.used_count).toBe(1);
      expect(metrics2?.helpful_count).toBe(1);
      expect(metrics3?.dismissed_count).toBe(1);
      expect((metrics3?.usefulness_score ?? 0) >= 0).toBe(true);
      expect((metrics3?.usefulness_score ?? 1) <= 1).toBe(true);
    });
  });
});
