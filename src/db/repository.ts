import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import type {
  Learning,
  LearningSummary,
  AddLearningInput,
  UpdateLearningInput,
  FileRef,
  LearningType,
  Scope,
  SearchMode,
  LearningVersion,
  ChangeType,
  SimilarLearning,
  PromotionCandidate,
  RelationshipGraph,
  GraphNode,
  GraphEdge,
  UpsertIfExists,
  FeedbackOutcome,
  FeedbackSource,
  AutonomyRun,
  Confidence,
  AutonomySource,
} from "../types.js";
import type { EmbeddingService } from "../embeddings/index.js";

// Simplified input types for repository methods (without tool-specific fields)
export interface ListOptions {
  scope?: Scope;
  type?: LearningType;
  tags?: string[];
  project_path?: string;
  limit: number;
  offset: number;
  include_deprecated?: boolean;
}

export interface SearchOptions {
  query: string;
  scope?: Scope;
  type?: LearningType;
  tags?: string[];
  project_path?: string;
  limit: number;
  mode?: SearchMode;
  semantic_weight?: number;
  include_deprecated?: boolean;
}

export interface SemanticSearchResult {
  id: string;
  distance: number;
}

export interface UpsertLearningInputInternal {
  id?: string;
  title: string;
  content: string;
  type: LearningType;
  scope: Scope;
  project_path?: string | null;
  tags: string[];
  file_references: FileRef[];
  related_ids: string[];
  confidence: Confidence;
  created_by: string;
  applies_to?: string[] | null;
  created_at?: string;
  updated_at?: string;
  version?: number;
  deprecated?: boolean;
  deprecated_reason?: string | null;
  deprecated_at?: string | null;
  if_exists?: UpsertIfExists;
}

export interface FeedbackEvent {
  id: number;
  learning_id: string;
  outcome: FeedbackOutcome;
  source: FeedbackSource;
  context: string | null;
  created_at: string;
}

export interface QualityMetrics {
  learning_id: string;
  used_count: number;
  helpful_count: number;
  dismissed_count: number;
  usefulness_score: number;
  updated_at: string;
}

export interface AutonomyRunInput {
  id?: string;
  project_path?: string;
  sources: AutonomySource[];
  maintenance: boolean;
  dry_run: boolean;
  status: "success" | "partial" | "failed";
  collected_count: number;
  inserted_count: number;
  skipped_count: number;
  notes?: string;
  started_at: string;
  finished_at: string;
}

export class LearningRepository {
  private embeddingService: EmbeddingService | null = null;

  constructor(private db: Database.Database) {}

  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  isSemanticSearchAvailable(): boolean {
    return this.embeddingService?.isAvailable() ?? false;
  }

  add(input: AddLearningInput): Learning {
    const id = uuidv4();
    const now = new Date().toISOString();

    const learning: Learning = {
      id,
      title: input.title,
      content: input.content,
      type: input.type,
      scope: input.scope,
      project_path: input.project_path,
      tags: input.tags,
      file_references: input.file_references,
      related_ids: input.related_ids,
      confidence: input.confidence,
      created_at: now,
      updated_at: now,
      created_by: input.created_by,
      version: 1,
      deprecated: false,
      deprecated_reason: null,
      deprecated_at: null,
      access_count: 0,
      last_accessed_at: null,
      applies_to: input.applies_to ?? null,
    };

    const insertLearning = this.db.prepare(`
      INSERT INTO learnings (id, title, content, type, scope, project_path, confidence, created_at, updated_at, created_by, version, applies_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTag = this.db.prepare(`
      INSERT INTO learning_tags (learning_id, tag) VALUES (?, ?)
    `);

    const insertFileRef = this.db.prepare(`
      INSERT INTO file_refs (learning_id, path, line_start, line_end, snippet)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      insertLearning.run(
        learning.id,
        learning.title,
        learning.content,
        learning.type,
        learning.scope,
        learning.project_path ?? null,
        learning.confidence,
        learning.created_at,
        learning.updated_at,
        learning.created_by,
        learning.version,
        learning.applies_to ? JSON.stringify(learning.applies_to) : null
      );

      for (const tag of learning.tags) {
        insertTag.run(learning.id, tag);
      }

      for (const ref of learning.file_references) {
        insertFileRef.run(
          learning.id,
          ref.path,
          ref.line_start ?? null,
          ref.line_end ?? null,
          ref.snippet ?? null
        );
      }
      this.syncRelationsForLearning(learning.id, learning.related_ids);
    })();

    // Save initial version for history
    this.saveVersion(learning.id, "create", learning.created_by);

    // Generate embedding asynchronously (fire-and-forget)
    this.generateEmbeddingAsync(learning.id, learning.title, learning.content);

    return learning;
  }

  upsert(
    input: UpsertLearningInputInternal,
    changedBy = "system"
  ): { learning: Learning; created: boolean; skipped: boolean } {
    const targetId = input.id ?? uuidv4();
    const existing = this.get(targetId);
    const ifExists = input.if_exists ?? "update";
    const now = new Date().toISOString();

    if (existing && ifExists === "skip") {
      return { learning: existing, created: false, skipped: true };
    }

    if (existing && ifExists === "error") {
      throw new Error(`Learning with id "${targetId}" already exists`);
    }

    const learning: Learning = existing
      ? {
          id: targetId,
          title: input.title,
          content: input.content,
          type: input.type,
          scope: input.scope,
          project_path: input.project_path ?? undefined,
          tags: input.tags,
          file_references: input.file_references,
          related_ids: input.related_ids,
          confidence: input.confidence,
          created_at: input.created_at ?? existing.created_at,
          updated_at: input.updated_at ?? now,
          created_by: input.created_by || existing.created_by,
          version:
            input.version ?? (input.updated_at || input.created_at ? existing.version : existing.version + 1),
          deprecated: input.deprecated ?? existing.deprecated,
          deprecated_reason: input.deprecated_reason ?? existing.deprecated_reason ?? null,
          deprecated_at: input.deprecated_at ?? existing.deprecated_at ?? null,
          access_count: existing.access_count,
          last_accessed_at: existing.last_accessed_at,
          applies_to: input.applies_to ?? null,
        }
      : {
          id: targetId,
          title: input.title,
          content: input.content,
          type: input.type,
          scope: input.scope,
          project_path: input.project_path ?? undefined,
          tags: input.tags,
          file_references: input.file_references,
          related_ids: input.related_ids,
          confidence: input.confidence,
          created_at: input.created_at ?? now,
          updated_at: input.updated_at ?? now,
          created_by: input.created_by,
          version: input.version ?? 1,
          deprecated: input.deprecated ?? false,
          deprecated_reason: input.deprecated_reason ?? null,
          deprecated_at: input.deprecated_at ?? null,
          access_count: 0,
          last_accessed_at: null,
          applies_to: input.applies_to ?? null,
        };

    this.db.transaction(() => {
      if (existing) {
        this.saveVersion(targetId, "update", changedBy);
      }

      this.db
        .prepare(
          `INSERT INTO learnings
            (id, title, content, type, scope, project_path, confidence, created_at, updated_at, created_by, version,
             deprecated, deprecated_reason, deprecated_at, access_count, last_accessed_at, applies_to)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             content = excluded.content,
             type = excluded.type,
             scope = excluded.scope,
             project_path = excluded.project_path,
             confidence = excluded.confidence,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             created_by = excluded.created_by,
             version = excluded.version,
             deprecated = excluded.deprecated,
             deprecated_reason = excluded.deprecated_reason,
             deprecated_at = excluded.deprecated_at,
             access_count = excluded.access_count,
             last_accessed_at = excluded.last_accessed_at,
             applies_to = excluded.applies_to`
        )
        .run(
          learning.id,
          learning.title,
          learning.content,
          learning.type,
          learning.scope,
          learning.project_path ?? null,
          learning.confidence,
          learning.created_at,
          learning.updated_at,
          learning.created_by,
          learning.version,
          learning.deprecated ? 1 : 0,
          learning.deprecated_reason,
          learning.deprecated_at,
          learning.access_count,
          learning.last_accessed_at,
          learning.applies_to ? JSON.stringify(learning.applies_to) : null
        );

      this.db
        .prepare("DELETE FROM learning_tags WHERE learning_id = ?")
        .run(learning.id);
      const insertTag = this.db.prepare(
        "INSERT INTO learning_tags (learning_id, tag) VALUES (?, ?)"
      );
      for (const tag of learning.tags) {
        insertTag.run(learning.id, tag);
      }

      this.db
        .prepare("DELETE FROM file_refs WHERE learning_id = ?")
        .run(learning.id);
      const insertFileRef = this.db.prepare(
        "INSERT INTO file_refs (learning_id, path, line_start, line_end, snippet) VALUES (?, ?, ?, ?, ?)"
      );
      for (const ref of learning.file_references) {
        insertFileRef.run(
          learning.id,
          ref.path,
          ref.line_start ?? null,
          ref.line_end ?? null,
          ref.snippet ?? null
        );
      }

      this.syncRelationsForLearning(learning.id, learning.related_ids);
    })();

    this.generateEmbeddingAsync(learning.id, learning.title, learning.content);

    const updated = this.get(learning.id);
    if (!updated) {
      throw new Error(`Failed to upsert learning "${learning.id}"`);
    }

    return { learning: updated, created: !existing, skipped: false };
  }

  get(id: string, recordAccess = false): Learning | null {
    const row = this.db
      .prepare(
        `
      SELECT * FROM learnings WHERE id = ?
    `
      )
      .get(id) as LearningRow | undefined;

    if (!row) return null;

    if (recordAccess) {
      this.recordAccess([id]);
    }

    return this.hydrateLearning(row);
  }

  update(input: UpdateLearningInput, updatedBy = "web-ui"): Learning | null {
    const existing = this.get(input.id);
    if (!existing) return null;

    // Save version before update
    this.saveVersion(input.id, "update", updatedBy);

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push("title = ?");
      values.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push("content = ?");
      values.push(input.content);
    }
    if (input.type !== undefined) {
      updates.push("type = ?");
      values.push(input.type);
    }
    if (input.scope !== undefined) {
      updates.push("scope = ?");
      values.push(input.scope);
    }
    if (input.project_path !== undefined) {
      updates.push("project_path = ?");
      values.push(input.project_path);
    }
    if (input.confidence !== undefined) {
      updates.push("confidence = ?");
      values.push(input.confidence);
    }
    if (input.deprecated !== undefined) {
      updates.push("deprecated = ?");
      values.push(input.deprecated ? 1 : 0);
      if (input.deprecated) {
        updates.push("deprecated_at = ?");
        values.push(new Date().toISOString());
      } else {
        updates.push("deprecated_at = NULL");
        updates.push("deprecated_reason = NULL");
      }
    }
    if (input.deprecated_reason !== undefined) {
      updates.push("deprecated_reason = ?");
      values.push(input.deprecated_reason);
    }
    if (input.applies_to !== undefined) {
      updates.push("applies_to = ?");
      values.push(input.applies_to ? JSON.stringify(input.applies_to) : null);
    }

    updates.push("updated_at = ?");
    values.push(now);
    updates.push("version = version + 1");

    values.push(input.id);

    this.db.transaction(() => {
      if (updates.length > 0) {
        this.db
          .prepare(`UPDATE learnings SET ${updates.join(", ")} WHERE id = ?`)
          .run(...values);
      }

      // Update tags if provided
      if (input.tags !== undefined) {
        this.db
          .prepare("DELETE FROM learning_tags WHERE learning_id = ?")
          .run(input.id);
        const insertTag = this.db.prepare(
          "INSERT INTO learning_tags (learning_id, tag) VALUES (?, ?)"
        );
        for (const tag of input.tags) {
          insertTag.run(input.id, tag);
        }
      }

      // Update file references if provided
      if (input.file_references !== undefined) {
        this.db
          .prepare("DELETE FROM file_refs WHERE learning_id = ?")
          .run(input.id);
        const insertFileRef = this.db.prepare(
          "INSERT INTO file_refs (learning_id, path, line_start, line_end, snippet) VALUES (?, ?, ?, ?, ?)"
        );
        for (const ref of input.file_references) {
          insertFileRef.run(
            input.id,
            ref.path,
            ref.line_start ?? null,
            ref.line_end ?? null,
            ref.snippet ?? null
          );
        }
      }

      // Update relations if provided
      if (input.related_ids !== undefined) {
        this.syncRelationsForLearning(input.id, input.related_ids);
      }
    })();

    // Regenerate embedding if title or content changed
    if (input.title !== undefined || input.content !== undefined) {
      const updated = this.get(input.id);
      if (updated) {
        this.generateEmbeddingAsync(updated.id, updated.title, updated.content);
      }
    }

    return this.get(input.id);
  }

  delete(id: string, deletedBy = "web-ui"): boolean {
    // Save version before delete
    this.saveVersion(id, "delete", deletedBy);

    // Delete embedding first (vec0 tables don't support ON DELETE CASCADE)
    this.db.prepare("DELETE FROM learning_embeddings WHERE learning_id = ?").run(id);
    this.db.prepare("DELETE FROM embedding_metadata WHERE learning_id = ?").run(id);

    const result = this.db
      .prepare("DELETE FROM learnings WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  list(input: ListOptions): LearningSummary[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!input.include_deprecated) {
      conditions.push("l.deprecated = 0");
    }

    if (input.scope) {
      conditions.push("l.scope = ?");
      params.push(input.scope);
    }

    if (input.type) {
      conditions.push("l.type = ?");
      params.push(input.type);
    }

    if (input.project_path) {
      conditions.push("l.project_path = ?");
      params.push(input.project_path);
    }

    if (input.tags && input.tags.length > 0) {
      conditions.push(`
        l.id IN (
          SELECT learning_id FROM learning_tags
          WHERE tag IN (${input.tags.map(() => "?").join(", ")})
          GROUP BY learning_id
          HAVING COUNT(DISTINCT tag) = ?
        )
      `);
      params.push(...input.tags, input.tags.length);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = this.db
      .prepare(
        `
      SELECT l.id, l.title, l.type, l.scope, l.confidence, l.created_at
      FROM learnings l
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, input.limit, input.offset) as SummaryRow[];

    return rows.map((row) => this.hydrateSummary(row));
  }

  search(input: SearchOptions): LearningSummary[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // FTS search
    conditions.push("learnings_fts MATCH ?");
    params.push(input.query);

    if (!input.include_deprecated) {
      conditions.push("l.deprecated = 0");
    }

    if (input.scope) {
      conditions.push("l.scope = ?");
      params.push(input.scope);
    }

    if (input.type) {
      conditions.push("l.type = ?");
      params.push(input.type);
    }

    if (input.project_path) {
      conditions.push("l.project_path = ?");
      params.push(input.project_path);
    }

    if (input.tags && input.tags.length > 0) {
      conditions.push(`
        l.id IN (
          SELECT learning_id FROM learning_tags
          WHERE tag IN (${input.tags.map(() => "?").join(", ")})
          GROUP BY learning_id
          HAVING COUNT(DISTINCT tag) = ?
        )
      `);
      params.push(...input.tags, input.tags.length);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const rows = this.db
      .prepare(
        `
      SELECT l.id, l.title, l.type, l.scope, l.confidence, l.created_at,
             bm25(learnings_fts) as relevance_score
      FROM learnings l
      JOIN learnings_fts ON l.rowid = learnings_fts.rowid
      ${whereClause}
      ORDER BY relevance_score
      LIMIT ?
    `
      )
      .all(...params, input.limit) as (SummaryRow & {
      relevance_score: number;
    })[];

    if (rows.length === 0) return [];

    const minScore = Math.min(...rows.map((r) => r.relevance_score));
    const maxScore = Math.max(...rows.map((r) => r.relevance_score));
    const range = maxScore - minScore || 1;
    const relevanceById = new Map<string, number>();
    for (const row of rows) {
      const normalized = 1 - (row.relevance_score - minScore) / range;
      relevanceById.set(row.id, normalized);
    }

    return this.rankSummariesWithQuality(
      rows.map((row) => this.hydrateSummary(row)),
      relevanceById
    );
  }

  linkLearnings(sourceId: string, targetId: string): boolean {
    // Verify both exist
    const source = this.get(sourceId);
    const target = this.get(targetId);
    if (!source || !target) return false;

    const insertRelation = this.db.prepare(
      "INSERT OR IGNORE INTO learning_relations (source_id, target_id) VALUES (?, ?)"
    );

    this.db.transaction(() => {
      insertRelation.run(sourceId, targetId);
      insertRelation.run(targetId, sourceId);
    })();

    return true;
  }

  // Embedding methods

  private generateEmbeddingAsync(
    id: string,
    title: string,
    content: string
  ): void {
    // Fire-and-forget embedding generation
    // Silently ignore errors (db might be closed before this completes)
    this.generateEmbedding(id, title, content).catch(() => {
      // Intentionally silent - embedding may be regenerated manually
    });
  }

  async generateEmbedding(
    id: string,
    title: string,
    content: string
  ): Promise<boolean> {
    if (!this.embeddingService?.isAvailable()) {
      return false;
    }

    const text = `${title}\n\n${content}`;
    const contentHash = createHash("sha256").update(text).digest("hex");

    // Check if we already have an up-to-date embedding
    const existing = this.db
      .prepare("SELECT content_hash FROM embedding_metadata WHERE learning_id = ?")
      .get(id) as { content_hash: string } | undefined;

    if (existing?.content_hash === contentHash) {
      return true; // Already up-to-date
    }

    const result = await this.embeddingService.embed(text);
    if (!result) {
      return false;
    }

    const now = new Date().toISOString();

    // Delete existing embedding if any
    this.db
      .prepare("DELETE FROM learning_embeddings WHERE learning_id = ?")
      .run(id);
    this.db
      .prepare("DELETE FROM embedding_metadata WHERE learning_id = ?")
      .run(id);

    // Insert new embedding
    this.db
      .prepare("INSERT INTO learning_embeddings (learning_id, embedding) VALUES (?, ?)")
      .run(id, result.embedding);

    // Insert metadata
    this.db
      .prepare(
        `INSERT INTO embedding_metadata (learning_id, provider, model, dimensions, embedded_at, content_hash)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, result.provider, result.model, result.dimensions, now, contentHash);

    return true;
  }

  semanticSearch(queryEmbedding: Float32Array, limit: number): SemanticSearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT learning_id, distance
         FROM learning_embeddings
         WHERE embedding MATCH ?
         ORDER BY distance
         LIMIT ?`
      )
      .all(queryEmbedding, limit) as { learning_id: string; distance: number }[];

    return rows.map((row) => ({
      id: row.learning_id,
      distance: row.distance,
    }));
  }

  async hybridSearch(input: SearchOptions): Promise<LearningSummary[]> {
    const mode = input.mode ?? "hybrid";
    const semanticWeight = input.semantic_weight ?? 0.5;

    // If keyword mode or semantic unavailable, use keyword search
    if (mode === "keyword" || !this.isSemanticSearchAvailable()) {
      return this.keywordSearch(input);
    }

    // If semantic-only mode
    if (mode === "semantic") {
      return this.pureSemanticSearch(input);
    }

    // Hybrid mode: combine keyword and semantic
    const keywordResults = this.keywordSearchWithScores(input);
    const semanticResults = await this.semanticSearchWithScores(input);

    if (semanticResults.size === 0) {
      // Fall back to keyword if semantic failed
      return this.keywordSearch(input);
    }

    // Combine and normalize scores
    const combined = this.combineSearchResults(
      keywordResults,
      semanticResults,
      semanticWeight
    );

    // Sort by combined score and limit
    const sortedEntries = Array.from(combined.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit);

    // Fetch summaries for the top results
    return this.getSummariesByIds(
      sortedEntries.map(([id]) => id),
      new Map(sortedEntries)
    );
  }

  private keywordSearch(input: SearchOptions): LearningSummary[] {
    // Same as existing search method
    return this.search({
      ...input,
      mode: undefined,
      semantic_weight: undefined,
    });
  }

  private keywordSearchWithScores(
    input: SearchOptions
  ): Map<string, number> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    conditions.push("learnings_fts MATCH ?");
    params.push(input.query);

    if (!input.include_deprecated) {
      conditions.push("l.deprecated = 0");
    }

    if (input.scope) {
      conditions.push("l.scope = ?");
      params.push(input.scope);
    }

    if (input.type) {
      conditions.push("l.type = ?");
      params.push(input.type);
    }

    if (input.project_path) {
      conditions.push("l.project_path = ?");
      params.push(input.project_path);
    }

    if (input.tags && input.tags.length > 0) {
      conditions.push(`
        l.id IN (
          SELECT learning_id FROM learning_tags
          WHERE tag IN (${input.tags.map(() => "?").join(", ")})
          GROUP BY learning_id
          HAVING COUNT(DISTINCT tag) = ?
        )
      `);
      params.push(...input.tags, input.tags.length);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Get more results than needed for merging
    const rows = this.db
      .prepare(
        `SELECT l.id, bm25(learnings_fts) as score
         FROM learnings l
         JOIN learnings_fts ON l.rowid = learnings_fts.rowid
         ${whereClause}
         ORDER BY score
         LIMIT ?`
      )
      .all(...params, input.limit * 2) as { id: string; score: number }[];

    // BM25 scores are negative (lower is better), normalize to 0-1
    const scores = new Map<string, number>();
    if (rows.length === 0) return scores;

    const minScore = Math.min(...rows.map((r) => r.score));
    const maxScore = Math.max(...rows.map((r) => r.score));
    const range = maxScore - minScore || 1;

    for (const row of rows) {
      // Convert BM25 (lower is better) to normalized score (higher is better)
      const normalized = 1 - (row.score - minScore) / range;
      scores.set(row.id, normalized);
    }

    return scores;
  }

  private async semanticSearchWithScores(
    input: SearchOptions
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.embeddingService?.isAvailable()) {
      return scores;
    }

    const queryResult = await this.embeddingService.embed(input.query);
    if (!queryResult) {
      return scores;
    }

    // Get semantic results, fetch more than needed for filtering and merging
    const results = this.semanticSearch(queryResult.embedding, input.limit * 2);

    if (results.length === 0) return scores;

    // Normalize distances to 0-1 scores (lower distance = higher score)
    const maxDistance = Math.max(...results.map((r) => r.distance));
    const minDistance = Math.min(...results.map((r) => r.distance));
    const range = maxDistance - minDistance || 1;

    for (const result of results) {
      const normalized = 1 - (result.distance - minDistance) / range;
      scores.set(result.id, normalized);
    }

    // Filter by scope, type, project_path, tags, deprecated if specified
    const needsFilter = input.scope || input.type || input.project_path || input.tags?.length || !input.include_deprecated;
    if (needsFilter) {
      const filteredScores = new Map<string, number>();
      for (const [id, score] of scores) {
        const learning = this.get(id);
        if (!learning) continue;

        if (!input.include_deprecated && learning.deprecated) continue;
        if (input.scope && learning.scope !== input.scope) continue;
        if (input.type && learning.type !== input.type) continue;
        if (input.project_path && learning.project_path !== input.project_path)
          continue;
        if (
          input.tags?.length &&
          !input.tags.every((t) => learning.tags.includes(t))
        )
          continue;

        filteredScores.set(id, score);
      }
      return filteredScores;
    }

    return scores;
  }

  private async pureSemanticSearch(input: SearchOptions): Promise<LearningSummary[]> {
    const scores = await this.semanticSearchWithScores(input);
    const sortedEntries = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit);

    return this.getSummariesByIds(
      sortedEntries.map(([id]) => id),
      new Map(sortedEntries)
    );
  }

  private combineSearchResults(
    keywordScores: Map<string, number>,
    semanticScores: Map<string, number>,
    semanticWeight: number
  ): Map<string, number> {
    const combined = new Map<string, number>();
    const keywordWeight = 1 - semanticWeight;

    // Get all unique IDs
    const allIds = new Set([...keywordScores.keys(), ...semanticScores.keys()]);

    for (const id of allIds) {
      const keywordScore = keywordScores.get(id) ?? 0;
      const semanticScore = semanticScores.get(id) ?? 0;

      // Weighted combination
      const combinedScore =
        keywordWeight * keywordScore + semanticWeight * semanticScore;
      combined.set(id, combinedScore);
    }

    return combined;
  }

  private calculateRecencyScore(createdAt: string): number {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 1 - ageDays / 365);
  }

  getUsefulnessScore(learningId: string): number {
    const row = this.db
      .prepare(
        "SELECT usefulness_score FROM learning_quality_metrics WHERE learning_id = ?"
      )
      .get(learningId) as { usefulness_score: number } | undefined;
    return row?.usefulness_score ?? 0.5;
  }

  private rankSummariesWithQuality(
    summaries: LearningSummary[],
    relevanceById?: Map<string, number>
  ): LearningSummary[] {
    if (summaries.length === 0) return summaries;

    const scoreWithSummary = summaries.map((summary, index) => {
      const fallbackRelevance =
        summaries.length === 1 ? 1 : 1 - index / (summaries.length - 1);
      const relevance =
        relevanceById?.get(summary.id) ??
        summary.relevance_score ??
        fallbackRelevance;
      const usefulness = this.getUsefulnessScore(summary.id);
      const recency = this.calculateRecencyScore(summary.created_at);
      const finalScore = relevance * 0.55 + usefulness * 0.3 + recency * 0.15;
      return {
        summary: {
          ...summary,
          relevance_score: relevance,
        },
        finalScore,
      };
    });

    scoreWithSummary.sort((a, b) => b.finalScore - a.finalScore);
    return scoreWithSummary.map((item) => item.summary);
  }

  getSummariesByIds(
    ids: string[],
    relevanceById?: Map<string, number>
  ): LearningSummary[] {
    if (ids.length === 0) return [];

    const summaries: LearningSummary[] = [];
    for (const id of ids) {
      const row = this.db
        .prepare(
          "SELECT id, title, type, scope, confidence, created_at FROM learnings WHERE id = ?"
        )
        .get(id) as SummaryRow | undefined;

      if (row) {
        const summary = this.hydrateSummary(row);
        if (relevanceById && relevanceById.has(summary.id)) {
          summary.relevance_score = relevanceById.get(summary.id);
        }
        summaries.push(summary);
      }
    }

    return this.rankSummariesWithQuality(summaries, relevanceById);
  }

  // Methods for reembed tool
  getLearningsWithoutEmbeddings(limit: number): Array<{ id: string; title: string; content: string }> {
    const rows = this.db
      .prepare(
        `SELECT l.id, l.title, l.content
         FROM learnings l
         LEFT JOIN embedding_metadata em ON l.id = em.learning_id
         WHERE em.learning_id IS NULL
         LIMIT ?`
      )
      .all(limit) as Array<{ id: string; title: string; content: string }>;

    return rows;
  }

  getAllLearningsForEmbedding(limit: number, offset: number): Array<{ id: string; title: string; content: string }> {
    const rows = this.db
      .prepare(
        `SELECT id, title, content
         FROM learnings
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Array<{ id: string; title: string; content: string }>;

    return rows;
  }

  getEmbeddingStats(): { total: number; embedded: number } {
    const total = (
      this.db.prepare("SELECT COUNT(*) as count FROM learnings").get() as {
        count: number;
      }
    ).count;

    const embedded = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM embedding_metadata")
        .get() as { count: number }
    ).count;

    return { total, embedded };
  }

  getProjects(): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT project_path
         FROM learnings
         WHERE project_path IS NOT NULL
         ORDER BY project_path`
      )
      .all() as { project_path: string }[];
    return rows.map((r) => r.project_path);
  }

  // ==================== VERSION HISTORY METHODS ====================

  saveVersion(
    learningId: string,
    changeType: ChangeType,
    changedBy: string
  ): void {
    const learning = this.get(learningId);
    if (!learning) return;

    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO learning_versions
         (learning_id, version, title, content, type, scope, project_path, confidence,
          tags_json, file_refs_json, related_ids_json, changed_at, changed_by, change_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        learningId,
        learning.version,
        learning.title,
        learning.content,
        learning.type,
        learning.scope,
        learning.project_path ?? null,
        learning.confidence,
        JSON.stringify(learning.tags),
        JSON.stringify(learning.file_references),
        JSON.stringify(learning.related_ids),
        now,
        changedBy,
        changeType
      );
  }

  getVersionHistory(learningId: string, limit = 50): LearningVersion[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM learning_versions
         WHERE learning_id = ?
         ORDER BY version DESC
         LIMIT ?`
      )
      .all(learningId, limit) as VersionRow[];

    return rows.map((row) => this.hydrateVersion(row));
  }

  getVersion(learningId: string, version: number): LearningVersion | null {
    const row = this.db
      .prepare(
        `SELECT * FROM learning_versions
         WHERE learning_id = ? AND version = ?`
      )
      .get(learningId, version) as VersionRow | undefined;

    if (!row) return null;
    return this.hydrateVersion(row);
  }

  rollbackToVersion(
    learningId: string,
    version: number,
    changedBy: string
  ): Learning | null {
    const targetVersion = this.getVersion(learningId, version);
    if (!targetVersion) return null;

    const existing = this.get(learningId);
    if (!existing) return null;

    // Save current state before rollback
    this.saveVersion(learningId, "update", changedBy);

    // Update the learning to the target version state
    const now = new Date().toISOString();
    this.db.transaction(() => {
      // Update main learning record
      this.db
        .prepare(
          `UPDATE learnings
           SET title = ?, content = ?, type = ?, scope = ?, project_path = ?,
               confidence = ?, updated_at = ?, version = version + 1
           WHERE id = ?`
        )
        .run(
          targetVersion.title,
          targetVersion.content,
          targetVersion.type,
          targetVersion.scope,
          targetVersion.project_path,
          targetVersion.confidence,
          now,
          learningId
        );

      // Update tags
      this.db
        .prepare("DELETE FROM learning_tags WHERE learning_id = ?")
        .run(learningId);
      const insertTag = this.db.prepare(
        "INSERT INTO learning_tags (learning_id, tag) VALUES (?, ?)"
      );
      for (const tag of targetVersion.tags) {
        insertTag.run(learningId, tag);
      }

      // Update file references
      this.db
        .prepare("DELETE FROM file_refs WHERE learning_id = ?")
        .run(learningId);
      const insertFileRef = this.db.prepare(
        "INSERT INTO file_refs (learning_id, path, line_start, line_end, snippet) VALUES (?, ?, ?, ?, ?)"
      );
      for (const ref of targetVersion.file_references) {
        insertFileRef.run(
          learningId,
          ref.path,
          ref.line_start ?? null,
          ref.line_end ?? null,
          ref.snippet ?? null
        );
      }

      // Update relations
      this.syncRelationsForLearning(learningId, targetVersion.related_ids);
    })();

    // Save the new state after rollback
    this.saveVersion(learningId, "update", changedBy);

    // Regenerate embedding
    const updated = this.get(learningId);
    if (updated) {
      this.generateEmbeddingAsync(updated.id, updated.title, updated.content);
    }

    return updated;
  }

  getVersionCount(learningId: string): number {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM learning_versions WHERE learning_id = ?")
      .get(learningId) as { count: number };
    return result.count;
  }

  // ==================== SIMILARITY/CONFLICT DETECTION METHODS ====================

  async findSimilar(
    text: string,
    excludeId?: string,
    threshold = 0.7,
    limit = 5
  ): Promise<SimilarLearning[]> {
    if (!this.embeddingService?.isAvailable()) {
      return [];
    }

    const queryResult = await this.embeddingService.embed(text);
    if (!queryResult) {
      return [];
    }

    // Get more results than needed for filtering
    const results = this.semanticSearch(queryResult.embedding, limit * 2);

    const similar: SimilarLearning[] = [];
    for (const result of results) {
      if (excludeId && result.id === excludeId) continue;

      // Convert distance to similarity (assuming cosine distance where lower is more similar)
      // sqlite-vec uses L2 distance by default, so we normalize it
      const similarity = Math.max(0, 1 - result.distance / 2);

      if (similarity >= threshold) {
        const learning = this.get(result.id);
        if (learning) {
          similar.push({
            id: learning.id,
            title: learning.title,
            type: learning.type,
            scope: learning.scope,
            similarity,
          });
        }
      }

      if (similar.length >= limit) break;
    }

    return similar;
  }

  async checkForDuplicates(
    learningId: string,
    threshold = 0.7
  ): Promise<SimilarLearning[]> {
    const learning = this.get(learningId);
    if (!learning) return [];

    const text = `${learning.title}\n\n${learning.content}`;
    return this.findSimilar(text, learningId, threshold, 5);
  }

  // ==================== PROMOTION METHODS ====================

  getPromotionCandidates(fromScope: Scope, limit = 20): PromotionCandidate[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, type, scope, project_path, created_at
         FROM learnings
         WHERE scope = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(fromScope, limit) as Array<{
        id: string;
        title: string;
        type: string;
        scope: string;
        project_path: string | null;
        created_at: string;
      }>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type as LearningType,
      scope: row.scope as Scope,
      project_path: row.project_path ?? undefined,
      created_at: row.created_at,
    }));
  }

  promoteLearning(id: string, toScope: Scope, promotedBy: string): Learning | null {
    const learning = this.get(id);
    if (!learning) return null;

    // Validate promotion rules
    const validPromotions: Record<Scope, Scope[]> = {
      project: ["cross-project", "global"],
      "cross-project": ["global"],
      global: [],
    };

    if (!validPromotions[learning.scope].includes(toScope)) {
      return null; // Invalid promotion
    }

    // Save version before promotion
    this.saveVersion(id, "update", promotedBy);

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE learnings
         SET scope = ?, project_path = NULL, updated_at = ?, version = version + 1
         WHERE id = ?`
      )
      .run(toScope, now, id);

    // Save version after promotion
    this.saveVersion(id, "update", promotedBy);

    return this.get(id);
  }

  // ==================== RELATIONSHIP GRAPH METHODS ====================

  getRelationshipGraph(options?: {
    scope?: Scope;
    type?: LearningType;
    limit?: number;
  }): RelationshipGraph {
    const limit = options?.limit ?? 100;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.scope) {
      conditions.push("scope = ?");
      params.push(options.scope);
    }
    if (options?.type) {
      conditions.push("type = ?");
      params.push(options.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get nodes
    const nodeRows = this.db
      .prepare(
        `SELECT id, title, type, scope FROM learnings ${whereClause} LIMIT ?`
      )
      .all(...params, limit) as Array<{
        id: string;
        title: string;
        type: string;
        scope: string;
      }>;

    const nodeIds = new Set(nodeRows.map((r) => r.id));
    const nodes: GraphNode[] = nodeRows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type as LearningType,
      scope: row.scope as Scope,
    }));

    // Get edges (only between nodes in our set)
    const placeholders = Array.from(nodeIds).map(() => "?").join(",");
    const edgeRows = nodeIds.size > 0
      ? (this.db
          .prepare(
            `SELECT DISTINCT source_id, target_id FROM learning_relations
             WHERE source_id IN (${placeholders}) AND target_id IN (${placeholders})`
          )
          .all(...nodeIds, ...nodeIds) as Array<{
            source_id: string;
            target_id: string;
          }>)
      : [];

    const edges: GraphEdge[] = edgeRows.map((row) => ({
      source: row.source_id,
      target: row.target_id,
    }));

    return { nodes, edges };
  }

  getConnectedLearnings(learningId: string, depth = 2): RelationshipGraph {
    const visited = new Set<string>();
    const nodesToProcess = [learningId];
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();

    let currentDepth = 0;
    while (nodesToProcess.length > 0 && currentDepth < depth) {
      const nextLevel: string[] = [];

      for (const nodeId of nodesToProcess) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        // Get the learning
        const learning = this.get(nodeId);
        if (!learning) continue;

        nodes.push({
          id: learning.id,
          title: learning.title,
          type: learning.type,
          scope: learning.scope,
        });

        // Get related learnings
        const relations = this.db
          .prepare(
            `SELECT target_id FROM learning_relations WHERE source_id = ?`
          )
          .all(nodeId) as { target_id: string }[];

        for (const rel of relations) {
          const edgeKey = [nodeId, rel.target_id].sort().join("-");
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ source: nodeId, target: rel.target_id });
          }
          if (!visited.has(rel.target_id)) {
            nextLevel.push(rel.target_id);
          }
        }
      }

      nodesToProcess.length = 0;
      nodesToProcess.push(...nextLevel);
      currentDepth++;
    }

    // Process any remaining nodes at the final depth (to get their info but not their connections)
    for (const nodeId of nodesToProcess) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const learning = this.get(nodeId);
      if (learning) {
        nodes.push({
          id: learning.id,
          title: learning.title,
          type: learning.type,
          scope: learning.scope,
        });
      }
    }

    return { nodes, edges };
  }

  verifyRelations(): {
    asymmetric: Array<{ source_id: string; target_id: string }>;
    orphan_sources: Array<{ source_id: string; target_id: string }>;
    orphan_targets: Array<{ source_id: string; target_id: string }>;
  } {
    const asymmetric = this.db
      .prepare(
        `SELECT lr.source_id, lr.target_id
         FROM learning_relations lr
         LEFT JOIN learning_relations reverse
           ON reverse.source_id = lr.target_id AND reverse.target_id = lr.source_id
         WHERE reverse.source_id IS NULL`
      )
      .all() as Array<{ source_id: string; target_id: string }>;

    const orphan_sources = this.db
      .prepare(
        `SELECT lr.source_id, lr.target_id
         FROM learning_relations lr
         LEFT JOIN learnings source ON source.id = lr.source_id
         WHERE source.id IS NULL`
      )
      .all() as Array<{ source_id: string; target_id: string }>;

    const orphan_targets = this.db
      .prepare(
        `SELECT lr.source_id, lr.target_id
         FROM learning_relations lr
         LEFT JOIN learnings target ON target.id = lr.target_id
         WHERE target.id IS NULL`
      )
      .all() as Array<{ source_id: string; target_id: string }>;

    return { asymmetric, orphan_sources, orphan_targets };
  }

  recordAccess(ids: string[]): void {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE learnings SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`
    );
    this.db.transaction(() => {
      for (const id of ids) {
        stmt.run(now, id);
      }
    })();
  }

  recordFeedback(
    learningId: string,
    outcome: FeedbackOutcome,
    source: FeedbackSource,
    context?: string
  ): QualityMetrics | null {
    const learning = this.get(learningId);
    if (!learning) return null;

    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO learning_feedback (learning_id, outcome, source, context, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(learningId, outcome, source, context ?? null, now);

      const existing = this.db
        .prepare(
          `SELECT used_count, helpful_count, dismissed_count
           FROM learning_quality_metrics
           WHERE learning_id = ?`
        )
        .get(learningId) as
        | { used_count: number; helpful_count: number; dismissed_count: number }
        | undefined;

      const usedCount = (existing?.used_count ?? 0) + (outcome === "used" ? 1 : 0);
      const helpfulCount =
        (existing?.helpful_count ?? 0) + (outcome === "helpful" ? 1 : 0);
      const dismissedCount =
        (existing?.dismissed_count ?? 0) + (outcome === "dismissed" ? 1 : 0);
      const total = usedCount + helpfulCount + dismissedCount;
      const rawScore =
        total === 0
          ? 0
          : (helpfulCount + usedCount * 0.5 - dismissedCount) / total;
      const usefulnessScore = Math.max(0, Math.min(1, (rawScore + 1) / 2));

      this.db
        .prepare(
          `INSERT INTO learning_quality_metrics
            (learning_id, used_count, helpful_count, dismissed_count, usefulness_score, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(learning_id) DO UPDATE SET
             used_count = excluded.used_count,
             helpful_count = excluded.helpful_count,
             dismissed_count = excluded.dismissed_count,
             usefulness_score = excluded.usefulness_score,
             updated_at = excluded.updated_at`
        )
        .run(
          learningId,
          usedCount,
          helpfulCount,
          dismissedCount,
          usefulnessScore,
          now
        );
    })();

    return this.getQualityMetrics(learningId);
  }

  getQualityMetrics(learningId: string): QualityMetrics | null {
    const row = this.db
      .prepare("SELECT * FROM learning_quality_metrics WHERE learning_id = ?")
      .get(learningId) as QualityMetrics | undefined;
    return row ?? null;
  }

  createAutonomyRun(input: AutonomyRunInput): AutonomyRun {
    const id = input.id ?? uuidv4();

    this.db
      .prepare(
        `INSERT INTO autonomy_runs
          (id, project_path, sources_json, maintenance, dry_run, status, collected_count,
           inserted_count, skipped_count, notes, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.project_path ?? null,
        JSON.stringify(input.sources),
        input.maintenance ? 1 : 0,
        input.dry_run ? 1 : 0,
        input.status,
        input.collected_count,
        input.inserted_count,
        input.skipped_count,
        input.notes ?? null,
        input.started_at,
        input.finished_at
      );

    const row = this.db
      .prepare("SELECT * FROM autonomy_runs WHERE id = ?")
      .get(id) as AutonomyRunRow | undefined;
    if (!row) {
      throw new Error("Failed to create autonomy run");
    }
    return this.hydrateAutonomyRun(row);
  }

  listAutonomyRuns(limit = 50): AutonomyRun[] {
    const rows = this.db
      .prepare("SELECT * FROM autonomy_runs ORDER BY started_at DESC LIMIT ?")
      .all(limit) as AutonomyRunRow[];
    return rows.map((row) => this.hydrateAutonomyRun(row));
  }

  isAutonomyFingerprintSeen(fingerprint: string): boolean {
    const row = this.db
      .prepare("SELECT id FROM autonomy_candidates WHERE fingerprint = ?")
      .get(fingerprint) as { id: string } | undefined;
    return !!row;
  }

  recordAutonomyCandidate(input: {
    id?: string;
    run_id: string;
    source: "git" | "tests" | "pr" | "maintenance";
    fingerprint: string;
    decision:
      | "inserted"
      | "skipped_duplicate"
      | "skipped_low_confidence"
      | "suggested"
      | "error";
    learning_id?: string;
    payload_json: string;
    reason?: string;
    created_at?: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO autonomy_candidates
          (id, run_id, source, fingerprint, decision, learning_id, payload_json, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id ?? uuidv4(),
        input.run_id,
        input.source,
        input.fingerprint,
        input.decision,
        input.learning_id ?? null,
        input.payload_json,
        input.reason ?? null,
        input.created_at ?? new Date().toISOString()
      );
  }

  findByFileRefs(filePaths: string[], limit = 20): Learning[] {
    if (filePaths.length === 0) return [];

    const placeholders = filePaths.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT DISTINCT l.* FROM learnings l
         JOIN file_refs fr ON fr.learning_id = l.id
         WHERE fr.path IN (${placeholders}) AND l.deprecated = 0
         LIMIT ?`
      )
      .all(...filePaths, limit) as LearningRow[];

    return rows.map((row) => this.hydrateLearning(row));
  }

  findMatchingRules(filePaths: string[], projectPath?: string): Learning[] {
    const conditions: string[] = ["l.type = 'rule'", "l.deprecated = 0", "l.applies_to IS NOT NULL"];
    const params: unknown[] = [];

    if (projectPath) {
      conditions.push("(l.project_path IS NULL OR l.project_path = ?)");
      params.push(projectPath);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM learnings l WHERE ${conditions.join(" AND ")}`
      )
      .all(...params) as LearningRow[];

    // Filter by glob matching in JS
    const matched: Learning[] = [];
    for (const row of rows) {
      const appliesTo: string[] = row.applies_to ? JSON.parse(row.applies_to) : [];
      if (appliesTo.length === 0) continue;

      const isMatch = filePaths.some((filePath) =>
        appliesTo.some((pattern) => this.globMatch(filePath, pattern))
      );

      if (isMatch) {
        matched.push(this.hydrateLearning(row));
      }
    }

    return matched;
  }

  private globMatch(filePath: string, pattern: string): boolean {
    // Simple glob matching: supports * and ** patterns
    // Convert glob to regex
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "{{GLOBSTAR}}")
      .replace(/\*/g, "[^/]*")
      .replace(/\{\{GLOBSTAR\}\}/g, ".*");
    try {
      return new RegExp(`^${regexStr}$`).test(filePath) || new RegExp(`(^|/)${regexStr}$`).test(filePath);
    } catch {
      return false;
    }
  }

  private syncRelationsForLearning(learningId: string, relatedIds: string[]): void {
    this.db
      .prepare(
        "DELETE FROM learning_relations WHERE source_id = ? OR target_id = ?"
      )
      .run(learningId, learningId);

    if (relatedIds.length === 0) return;
    const insertRelation = this.db.prepare(
      "INSERT OR IGNORE INTO learning_relations (source_id, target_id) VALUES (?, ?)"
    );
    for (const relatedId of new Set(relatedIds)) {
      if (relatedId === learningId) continue;
      insertRelation.run(learningId, relatedId);
      insertRelation.run(relatedId, learningId);
    }
  }

  private hydrateAutonomyRun(row: AutonomyRunRow): AutonomyRun {
    return {
      id: row.id,
      project_path: row.project_path,
      sources_json: row.sources_json,
      maintenance: row.maintenance === 1,
      dry_run: row.dry_run === 1,
      status: row.status as "success" | "partial" | "failed",
      collected_count: row.collected_count,
      inserted_count: row.inserted_count,
      skipped_count: row.skipped_count,
      notes: row.notes,
      started_at: row.started_at,
      finished_at: row.finished_at,
    };
  }

  private hydrateVersion(row: VersionRow): LearningVersion {
    return {
      id: row.id,
      learning_id: row.learning_id,
      version: row.version,
      title: row.title,
      content: row.content,
      type: row.type as LearningType,
      scope: row.scope as Scope,
      project_path: row.project_path,
      confidence: row.confidence as "low" | "medium" | "high",
      tags: JSON.parse(row.tags_json),
      file_references: JSON.parse(row.file_refs_json),
      related_ids: JSON.parse(row.related_ids_json),
      changed_at: row.changed_at,
      changed_by: row.changed_by,
      change_type: row.change_type as ChangeType,
    };
  }

  private hydrateLearning(row: LearningRow): Learning {
    const tags = this.db
      .prepare("SELECT tag FROM learning_tags WHERE learning_id = ?")
      .all(row.id) as { tag: string }[];

    const fileRefs = this.db
      .prepare("SELECT * FROM file_refs WHERE learning_id = ?")
      .all(row.id) as FileRefRow[];

    const relatedIds = this.db
      .prepare("SELECT target_id FROM learning_relations WHERE source_id = ?")
      .all(row.id) as { target_id: string }[];

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type as Learning["type"],
      scope: row.scope as Learning["scope"],
      project_path: row.project_path ?? undefined,
      tags: tags.map((t) => t.tag),
      file_references: fileRefs.map(
        (r): FileRef => ({
          path: r.path,
          line_start: r.line_start ?? undefined,
          line_end: r.line_end ?? undefined,
          snippet: r.snippet ?? undefined,
        })
      ),
      related_ids: relatedIds.map((r) => r.target_id),
      confidence: row.confidence as Learning["confidence"],
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      version: row.version,
      deprecated: row.deprecated === 1,
      deprecated_reason: row.deprecated_reason ?? null,
      deprecated_at: row.deprecated_at ?? null,
      access_count: row.access_count,
      last_accessed_at: row.last_accessed_at ?? null,
      applies_to: row.applies_to ? JSON.parse(row.applies_to) : null,
    };
  }

  private hydrateSummary(
    row: SummaryRow & { relevance_score?: number }
  ): LearningSummary {
    const tags = this.db
      .prepare("SELECT tag FROM learning_tags WHERE learning_id = ?")
      .all(row.id) as { tag: string }[];

    return {
      id: row.id,
      title: row.title,
      type: row.type as LearningSummary["type"],
      scope: row.scope as LearningSummary["scope"],
      tags: tags.map((t) => t.tag),
      confidence: row.confidence as LearningSummary["confidence"],
      created_at: row.created_at,
      relevance_score: row.relevance_score,
    };
  }
}

interface LearningRow {
  id: string;
  title: string;
  content: string;
  type: string;
  scope: string;
  project_path: string | null;
  confidence: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  deprecated: number;
  deprecated_reason: string | null;
  deprecated_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  applies_to: string | null;
}

interface FileRefRow {
  id: number;
  learning_id: string;
  path: string;
  line_start: number | null;
  line_end: number | null;
  snippet: string | null;
}

interface SummaryRow {
  id: string;
  title: string;
  type: string;
  scope: string;
  confidence: string;
  created_at: string;
}

interface VersionRow {
  id: number;
  learning_id: string;
  version: number;
  title: string;
  content: string;
  type: string;
  scope: string;
  project_path: string | null;
  confidence: string;
  tags_json: string;
  file_refs_json: string;
  related_ids_json: string;
  changed_at: string;
  changed_by: string;
  change_type: string;
}

interface AutonomyRunRow {
  id: string;
  project_path: string | null;
  sources_json: string;
  maintenance: number;
  dry_run: number;
  status: string;
  collected_count: number;
  inserted_count: number;
  skipped_count: number;
  notes: string | null;
  started_at: string;
  finished_at: string;
}
