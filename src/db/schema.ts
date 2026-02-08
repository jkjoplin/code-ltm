import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";
import fs from "node:fs";
import { getDbPath as getDbPathFromConfig } from "../config/index.js";

export function getDbPath(): string {
  return getDbPathFromConfig();
}

export function ensureDbDir(): void {
  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

export function createDatabase(): Database.Database {
  ensureDbDir();
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma("journal_mode = WAL");
  // Explicitly enforce foreign key constraints.
  db.pragma("foreign_keys = ON");

  // Load sqlite-vec extension for vector search
  sqliteVec.load(db);

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = getMigrations();
  const applied = new Set(
    db
      .prepare("SELECT name FROM migrations")
      .all()
      .map((row) => (row as { name: string }).name)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      db.exec(migration.sql);
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
        migration.name
      );
    }
  }
}

interface Migration {
  name: string;
  sql: string;
}

function getMigrations(): Migration[] {
  return [
    {
      name: "001_initial_schema",
      sql: `
        -- Main learnings table
        CREATE TABLE IF NOT EXISTS learnings (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'investigation', 'documentation', 'tip')),
          scope TEXT NOT NULL CHECK (scope IN ('project', 'cross-project', 'global')),
          project_path TEXT,
          confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1
        );

        -- Tags stored in separate table for efficient querying
        CREATE TABLE IF NOT EXISTS learning_tags (
          learning_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          PRIMARY KEY (learning_id, tag),
          FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
        );

        -- File references
        CREATE TABLE IF NOT EXISTS file_refs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          learning_id TEXT NOT NULL,
          path TEXT NOT NULL,
          line_start INTEGER,
          line_end INTEGER,
          snippet TEXT,
          FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
        );

        -- Related learnings (many-to-many)
        CREATE TABLE IF NOT EXISTS learning_relations (
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          PRIMARY KEY (source_id, target_id),
          FOREIGN KEY (source_id) REFERENCES learnings(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES learnings(id) ON DELETE CASCADE
        );

        -- Indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_learnings_scope ON learnings(scope);
        CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
        CREATE INDEX IF NOT EXISTS idx_learnings_project_path ON learnings(project_path);
        CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
        CREATE INDEX IF NOT EXISTS idx_learning_tags_tag ON learning_tags(tag);
        CREATE INDEX IF NOT EXISTS idx_file_refs_learning_id ON file_refs(learning_id);

        -- Full-text search index for keyword search
        CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
          title,
          content,
          content='learnings',
          content_rowid='rowid'
        );

        -- Triggers to keep FTS in sync
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
      `,
    },
    {
      name: "002_embeddings_table",
      sql: `
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

        -- Index for finding learnings without embeddings
        CREATE INDEX IF NOT EXISTS idx_embedding_metadata_learning ON embedding_metadata(learning_id);
      `,
    },
    {
      name: "003_version_history",
      sql: `
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

        CREATE INDEX IF NOT EXISTS idx_learning_versions_learning ON learning_versions(learning_id);
        CREATE INDEX IF NOT EXISTS idx_learning_versions_changed_at ON learning_versions(changed_at);
      `,
    },
    {
      name: "004_add_suggestion_type",
      sql: `
        -- Add 'suggestion' to the type CHECK constraint
        -- SQLite requires table recreation to modify CHECK constraints
        PRAGMA foreign_keys = OFF;

        CREATE TABLE learnings_new (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'investigation', 'documentation', 'tip', 'suggestion')),
          scope TEXT NOT NULL CHECK (scope IN ('project', 'cross-project', 'global')),
          project_path TEXT,
          confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1
        );

        INSERT INTO learnings_new SELECT * FROM learnings;

        -- Drop old triggers
        DROP TRIGGER IF EXISTS learnings_ai;
        DROP TRIGGER IF EXISTS learnings_ad;
        DROP TRIGGER IF EXISTS learnings_au;

        -- Drop old table and rename
        DROP TABLE learnings;
        ALTER TABLE learnings_new RENAME TO learnings;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_learnings_scope ON learnings(scope);
        CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
        CREATE INDEX IF NOT EXISTS idx_learnings_project_path ON learnings(project_path);
        CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);

        -- Rebuild FTS index
        INSERT INTO learnings_fts(learnings_fts) VALUES('rebuild');

        -- Recreate FTS sync triggers
        CREATE TRIGGER learnings_ai AFTER INSERT ON learnings BEGIN
          INSERT INTO learnings_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        CREATE TRIGGER learnings_ad AFTER DELETE ON learnings BEGIN
          INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        END;

        CREATE TRIGGER learnings_au AFTER UPDATE ON learnings BEGIN
          INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
          INSERT INTO learnings_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        PRAGMA foreign_keys = ON;
      `,
    },
    {
      name: "005_add_rules_usage_deprecation",
      sql: `
        -- Add 'rule' type, deprecation fields, usage tracking, and applies_to
        -- SQLite requires table recreation to modify CHECK constraints
        PRAGMA foreign_keys = OFF;

        CREATE TABLE learnings_new (
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

        INSERT INTO learnings_new SELECT *, 0, NULL, NULL, 0, NULL, NULL FROM learnings;

        -- Drop old triggers
        DROP TRIGGER IF EXISTS learnings_ai;
        DROP TRIGGER IF EXISTS learnings_ad;
        DROP TRIGGER IF EXISTS learnings_au;

        -- Drop old table and rename
        DROP TABLE learnings;
        ALTER TABLE learnings_new RENAME TO learnings;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_learnings_scope ON learnings(scope);
        CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
        CREATE INDEX IF NOT EXISTS idx_learnings_project_path ON learnings(project_path);
        CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
        CREATE INDEX IF NOT EXISTS idx_learnings_deprecated ON learnings(deprecated);
        CREATE INDEX IF NOT EXISTS idx_file_refs_path ON file_refs(path);

        -- Rebuild FTS index
        INSERT INTO learnings_fts(learnings_fts) VALUES('rebuild');

        -- Recreate FTS sync triggers
        CREATE TRIGGER learnings_ai AFTER INSERT ON learnings BEGIN
          INSERT INTO learnings_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        CREATE TRIGGER learnings_ad AFTER DELETE ON learnings BEGIN
          INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        END;

        CREATE TRIGGER learnings_au AFTER UPDATE ON learnings BEGIN
          INSERT INTO learnings_fts(learnings_fts, rowid, title, content)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
          INSERT INTO learnings_fts(rowid, title, content)
          VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        PRAGMA foreign_keys = ON;
      `,
    },
    {
      name: "006_add_feedback_and_quality_metrics",
      sql: `
        CREATE TABLE IF NOT EXISTS learning_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          learning_id TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('used', 'helpful', 'dismissed')),
          source TEXT NOT NULL CHECK (source IN ('agent', 'user', 'auto')),
          context TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_learning_feedback_learning_id
        ON learning_feedback(learning_id);

        CREATE INDEX IF NOT EXISTS idx_learning_feedback_created_at
        ON learning_feedback(created_at);

        CREATE TABLE IF NOT EXISTS learning_quality_metrics (
          learning_id TEXT PRIMARY KEY,
          used_count INTEGER NOT NULL DEFAULT 0,
          helpful_count INTEGER NOT NULL DEFAULT 0,
          dismissed_count INTEGER NOT NULL DEFAULT 0,
          usefulness_score REAL NOT NULL DEFAULT 0.5,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE CASCADE
        );
      `,
    },
    {
      name: "007_add_autonomy_audit_tables",
      sql: `
        CREATE TABLE IF NOT EXISTS autonomy_runs (
          id TEXT PRIMARY KEY,
          project_path TEXT,
          sources_json TEXT NOT NULL,
          maintenance INTEGER NOT NULL DEFAULT 0,
          dry_run INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
          collected_count INTEGER NOT NULL DEFAULT 0,
          inserted_count INTEGER NOT NULL DEFAULT 0,
          skipped_count INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_autonomy_runs_started_at
        ON autonomy_runs(started_at);

        CREATE TABLE IF NOT EXISTS autonomy_candidates (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          source TEXT NOT NULL CHECK (source IN ('git', 'tests', 'pr', 'maintenance')),
          fingerprint TEXT NOT NULL,
          decision TEXT NOT NULL CHECK (decision IN ('inserted', 'skipped_duplicate', 'skipped_low_confidence', 'suggested', 'error')),
          learning_id TEXT,
          payload_json TEXT NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES autonomy_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (learning_id) REFERENCES learnings(id) ON DELETE SET NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_autonomy_candidates_fingerprint
        ON autonomy_candidates(fingerprint);

        CREATE INDEX IF NOT EXISTS idx_autonomy_candidates_run_id
        ON autonomy_candidates(run_id);
      `,
    },
  ];
}

export type { Database };
