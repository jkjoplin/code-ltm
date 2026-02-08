import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { LearningRepository } from "../db/repository.js";
import { generateDigest } from "./generator.js";
import type { AddLearningInput } from "../types.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  sqliteVec.load(db);

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

    CREATE VIRTUAL TABLE IF NOT EXISTS learning_embeddings USING vec0(
      learning_id TEXT PRIMARY KEY,
      embedding float[768]
    );

    CREATE TABLE IF NOT EXISTS embedding_metadata (
      learning_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      embedded_at TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
    );

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
  `);

  return db;
}

function addLearning(repo: LearningRepository, overrides: Partial<AddLearningInput> = {}) {
  const input: AddLearningInput = {
    title: "Test Learning",
    content: "Test content for learning",
    type: "pattern",
    scope: "project",
    tags: [],
    file_references: [],
    related_ids: [],
    confidence: "medium",
    created_by: "test",
    ...overrides,
  };
  return repo.add(input);
}

describe("generateDigest", () => {
  let db: Database.Database;
  let repo: LearningRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new LearningRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("filtering", () => {
    it("filters by min_confidence threshold", () => {
      addLearning(repo, { title: "Low Conf", confidence: "low" });
      addLearning(repo, { title: "Medium Conf", confidence: "medium" });
      addLearning(repo, { title: "High Conf", confidence: "high" });

      const result = generateDigest(repo, { min_confidence: "medium" });
      expect(result.output).toContain("Medium Conf");
      expect(result.output).toContain("High Conf");
      expect(result.output).not.toContain("Low Conf");
      expect(result.stats.total_matched).toBe(2);
    });

    it("filters with min_confidence high", () => {
      addLearning(repo, { title: "Low", confidence: "low" });
      addLearning(repo, { title: "Med", confidence: "medium" });
      addLearning(repo, { title: "High", confidence: "high" });

      const result = generateDigest(repo, { min_confidence: "high" });
      expect(result.output).toContain("High");
      expect(result.output).not.toContain("Low");
      expect(result.output).not.toContain("Med");
      expect(result.stats.total_matched).toBe(1);
    });

    it("filters by require_tag", () => {
      addLearning(repo, { title: "Tagged", tags: ["digest", "important"] });
      addLearning(repo, { title: "Untagged", tags: ["other"] });

      const result = generateDigest(repo, { require_tag: "digest" });
      expect(result.output).toContain("Tagged");
      expect(result.output).not.toContain("Untagged");
    });

    it("filters by scope", () => {
      addLearning(repo, { title: "Project", scope: "project" });
      addLearning(repo, { title: "Global", scope: "global" });

      const result = generateDigest(repo, { scope: "project" });
      expect(result.output).toContain("Project");
      expect(result.output).not.toContain("Global");
    });

    it("filters by type", () => {
      addLearning(repo, { title: "Gotcha One", type: "gotcha" });
      addLearning(repo, { title: "Pattern One", type: "pattern" });

      const result = generateDigest(repo, { type: "gotcha" });
      expect(result.output).toContain("Gotcha One");
      expect(result.output).not.toContain("Pattern One");
    });

    it("filters by tags", () => {
      addLearning(repo, { title: "Auth Learning", tags: ["auth"] });
      addLearning(repo, { title: "DB Learning", tags: ["database"] });

      const result = generateDigest(repo, { tags: ["auth"] });
      expect(result.output).toContain("Auth Learning");
      expect(result.output).not.toContain("DB Learning");
    });
  });

  describe("prioritization", () => {
    it("ranks gotchas above patterns", () => {
      addLearning(repo, { title: "A Pattern", type: "pattern", confidence: "high" });
      addLearning(repo, { title: "A Gotcha", type: "gotcha", confidence: "high" });

      const result = generateDigest(repo, { group_by_type: false });
      const gotchaIdx = result.output.indexOf("A Gotcha");
      const patternIdx = result.output.indexOf("A Pattern");
      expect(gotchaIdx).toBeLessThan(patternIdx);
    });

    it("ranks high confidence above medium confidence within same type", () => {
      addLearning(repo, { title: "Medium One", type: "gotcha", confidence: "medium" });
      addLearning(repo, { title: "High One", type: "gotcha", confidence: "high" });

      const result = generateDigest(repo, { group_by_type: false, min_confidence: "medium" });
      const highIdx = result.output.indexOf("High One");
      const medIdx = result.output.indexOf("Medium One");
      expect(highIdx).toBeLessThan(medIdx);
    });

    it("gives digest-tagged learnings a boost", () => {
      addLearning(repo, { title: "No Tag", type: "tip", confidence: "high", tags: [] });
      addLearning(repo, { title: "Digest Tagged", type: "tip", confidence: "medium", tags: ["digest"] });

      const result = generateDigest(repo, { group_by_type: false, min_confidence: "medium" });
      const digestIdx = result.output.indexOf("Digest Tagged");
      const noTagIdx = result.output.indexOf("No Tag");
      expect(digestIdx).toBeLessThan(noTagIdx);
    });
  });

  describe("budget enforcement", () => {
    it("respects max_chars", () => {
      for (let i = 0; i < 20; i++) {
        addLearning(repo, {
          title: `Learning ${i}`,
          content: `Content for learning ${i} with some extra text to take up space`,
          confidence: "high",
        });
      }

      const result = generateDigest(repo, { max_chars: 500, min_confidence: "medium" });
      expect(result.stats.character_count).toBeLessThanOrEqual(500);
      expect(result.stats.total_included).toBeLessThan(20);
    });

    it("truncates content at max_content_length", () => {
      addLearning(repo, {
        title: "Long Content",
        content: "x".repeat(1000),
        confidence: "high",
      });

      const result = generateDigest(repo, { max_content_length: 50 });
      expect(result.output).toContain("...");
      expect(result.stats.total_truncated).toBeGreaterThanOrEqual(1);
    });

    it("gracefully degrades from full to title-only", () => {
      addLearning(repo, {
        title: "First",
        content: "First learning content",
        type: "gotcha",
        confidence: "high",
      });
      addLearning(repo, {
        title: "Second",
        content: "Second learning content that is a bit longer",
        type: "gotcha",
        confidence: "high",
      });

      // Very tight budget
      const result = generateDigest(repo, {
        max_chars: 200,
        group_by_type: false,
        include_metadata: false,
        min_confidence: "medium",
      });

      // Should include at least one learning
      expect(result.stats.total_included).toBeGreaterThanOrEqual(1);
      expect(result.stats.character_count).toBeLessThanOrEqual(200);
    });
  });

  describe("output formats", () => {
    it("generates markdown by default", () => {
      addLearning(repo, { title: "Test", type: "gotcha", confidence: "high" });
      const result = generateDigest(repo);
      expect(result.output).toContain("### Gotchas");
      expect(result.output).toContain("**Test**");
    });

    it("generates index format", () => {
      addLearning(repo, { title: "Test", confidence: "high" });
      const result = generateDigest(repo, { format: "index" });
      expect(result.output).toContain("| ID | Title | Type | Confidence | Tags |");
      expect(result.output).toContain("Test");
    });

    it("generates JSON format", () => {
      addLearning(repo, { title: "Test", confidence: "high" });
      const result = generateDigest(repo, { format: "json" });
      const parsed = JSON.parse(result.output);
      expect(parsed.learnings).toHaveLength(1);
      expect(parsed.learnings[0].title).toBe("Test");
      expect(parsed.stats).toBeDefined();
    });
  });

  describe("empty DB", () => {
    it("handles empty database gracefully", () => {
      const result = generateDigest(repo);
      expect(result.stats.total_matched).toBe(0);
      expect(result.stats.total_included).toBe(0);
      expect(result.output).toBeDefined();
    });
  });
});
