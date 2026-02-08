// Types matching the server-side types
export type LearningType =
  | "gotcha"
  | "pattern"
  | "investigation"
  | "documentation"
  | "tip"
  | "suggestion"
  | "rule";
export type Scope = "project" | "cross-project" | "global";
export type Confidence = "low" | "medium" | "high";
export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface FileRef {
  path: string;
  line_start?: number;
  line_end?: number;
  snippet?: string;
}

export interface Learning {
  id: string;
  title: string;
  content: string;
  type: LearningType;
  scope: Scope;
  project_path?: string;
  tags: string[];
  file_references: FileRef[];
  related_ids: string[];
  confidence: Confidence;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  deprecated?: boolean;
  deprecated_reason?: string | null;
  deprecated_at?: string | null;
  access_count?: number;
  last_accessed_at?: string | null;
  applies_to?: string[] | null;
}

export interface LearningSummary {
  id: string;
  title: string;
  type: LearningType;
  scope: Scope;
  tags: string[];
  confidence: Confidence;
  created_at: string;
  relevance_score?: number;
}

export interface ListParams {
  scope?: Scope;
  type?: LearningType;
  tags?: string[];
  project_path?: string;
  limit?: number;
  offset?: number;
}

export interface SearchParams {
  query: string;
  scope?: Scope;
  type?: LearningType;
  tags?: string[];
  project_path?: string;
  limit?: number;
  mode?: SearchMode;
  semantic_weight?: number;
}

export interface CreateLearningInput {
  title: string;
  content: string;
  type: LearningType;
  scope: Scope;
  project_path?: string;
  tags?: string[];
  file_references?: FileRef[];
  related_ids?: string[];
  confidence?: Confidence;
  created_by?: string;
}

export interface UpdateLearningInput {
  title?: string;
  content?: string;
  type?: LearningType;
  scope?: Scope;
  project_path?: string | null;
  tags?: string[];
  file_references?: FileRef[];
  related_ids?: string[];
  confidence?: Confidence;
}

export interface Stats {
  total: number;
  embedded: number;
  semantic_available: boolean;
}

export interface ExportData {
  version: number;
  exported_at: string;
  count: number;
  learnings: Learning[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors?: Array<{ id: string; error: string }>;
  total: number;
}

// Version history types
export type ChangeType = "create" | "update" | "delete";

export interface LearningVersion {
  id: number;
  learning_id: string;
  version: number;
  title: string;
  content: string;
  type: LearningType;
  scope: Scope;
  project_path: string | null;
  confidence: Confidence;
  tags: string[];
  file_references: FileRef[];
  related_ids: string[];
  changed_at: string;
  changed_by: string;
  change_type: ChangeType;
}

// Similarity types
export interface SimilarLearning {
  id: string;
  title: string;
  type: LearningType;
  scope: Scope;
  similarity: number;
}

// Promotion types
export interface PromotionCandidate {
  id: string;
  title: string;
  type: LearningType;
  scope: Scope;
  project_path?: string;
  created_at: string;
}

// Graph types
export interface GraphNode {
  id: string;
  title: string;
  type: LearningType;
  scope: Scope;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const API_BASE = "/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export const api = {
  // List learnings with optional filters
  async listLearnings(
    params: ListParams = {}
  ): Promise<{ learnings: LearningSummary[]; limit: number; offset: number }> {
    const searchParams = new URLSearchParams();
    if (params.scope) searchParams.set("scope", params.scope);
    if (params.type) searchParams.set("type", params.type);
    if (params.tags?.length) searchParams.set("tags", params.tags.join(","));
    if (params.project_path) searchParams.set("project_path", params.project_path);
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.offset !== undefined) searchParams.set("offset", String(params.offset));

    const response = await fetch(`${API_BASE}/learnings?${searchParams}`);
    return handleResponse(response);
  },

  // Search learnings
  async searchLearnings(params: SearchParams): Promise<{
    learnings: LearningSummary[];
    query: string;
    mode: SearchMode;
    semantic_available: boolean;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.set("query", params.query);
    if (params.scope) searchParams.set("scope", params.scope);
    if (params.type) searchParams.set("type", params.type);
    if (params.tags?.length) searchParams.set("tags", params.tags.join(","));
    if (params.project_path) searchParams.set("project_path", params.project_path);
    if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
    if (params.mode) searchParams.set("mode", params.mode);
    if (params.semantic_weight !== undefined)
      searchParams.set("semantic_weight", String(params.semantic_weight));

    const response = await fetch(`${API_BASE}/learnings/search?${searchParams}`);
    return handleResponse(response);
  },

  // Get single learning
  async getLearning(id: string): Promise<Learning> {
    const response = await fetch(`${API_BASE}/learnings/${id}`);
    return handleResponse(response);
  },

  // Create new learning
  async createLearning(input: CreateLearningInput): Promise<Learning> {
    const response = await fetch(`${API_BASE}/learnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  // Update learning
  async updateLearning(id: string, input: UpdateLearningInput): Promise<Learning> {
    const response = await fetch(`${API_BASE}/learnings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  // Delete learning
  async deleteLearning(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/learnings/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },

  // Link two learnings
  async linkLearnings(
    sourceId: string,
    targetId: string
  ): Promise<{ success: boolean; source_id: string; target_id: string }> {
    const response = await fetch(`${API_BASE}/learnings/${sourceId}/link/${targetId}`, {
      method: "POST",
    });
    return handleResponse(response);
  },

  // Get stats
  async getStats(): Promise<Stats> {
    const response = await fetch(`${API_BASE}/stats`);
    return handleResponse(response);
  },

  // Get all tags
  async getTags(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/tags`);
    return handleResponse(response);
  },

  // Get all unique project paths
  async getProjects(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/projects`);
    return handleResponse(response);
  },

  // Export all learnings
  async exportLearnings(): Promise<ExportData> {
    const response = await fetch(`${API_BASE}/export`, { method: "POST" });
    return handleResponse(response);
  },

  // Import learnings
  async importLearnings(data: { learnings: Learning[] }): Promise<ImportResult> {
    const response = await fetch(`${API_BASE}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // ==================== VERSION HISTORY ====================

  // Get version history
  async getVersionHistory(
    id: string,
    limit?: number
  ): Promise<{ versions: LearningVersion[]; count: number }> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set("limit", String(limit));
    const response = await fetch(`${API_BASE}/learnings/${id}/versions?${params}`);
    return handleResponse(response);
  },

  // Get specific version
  async getVersion(id: string, version: number): Promise<LearningVersion> {
    const response = await fetch(`${API_BASE}/learnings/${id}/versions/${version}`);
    return handleResponse(response);
  },

  // Rollback to version
  async rollbackToVersion(
    id: string,
    version: number,
    changedBy?: string
  ): Promise<Learning> {
    const response = await fetch(`${API_BASE}/learnings/${id}/rollback/${version}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changed_by: changedBy || "web-ui" }),
    });
    return handleResponse(response);
  },

  // ==================== SIMILARITY/CONFLICT DETECTION ====================

  // Find similar learnings for an existing learning
  async getSimilarLearnings(
    id: string,
    threshold?: number,
    limit?: number
  ): Promise<{ similar: SimilarLearning[]; threshold: number; limit: number }> {
    const params = new URLSearchParams();
    if (threshold !== undefined) params.set("threshold", String(threshold));
    if (limit !== undefined) params.set("limit", String(limit));
    const response = await fetch(`${API_BASE}/learnings/${id}/similar?${params}`);
    return handleResponse(response);
  },

  // Check text for similar learnings (before creating)
  async checkSimilarity(
    title: string,
    content: string,
    threshold?: number
  ): Promise<{ similar: SimilarLearning[]; threshold: number }> {
    const params = new URLSearchParams();
    if (threshold !== undefined) params.set("threshold", String(threshold));
    const response = await fetch(`${API_BASE}/learnings/check-similarity?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    return handleResponse(response);
  },

  // ==================== PROMOTION ====================

  // Get promotion candidates
  async getPromotionCandidates(
    fromScope: Scope,
    limit?: number
  ): Promise<{ candidates: PromotionCandidate[]; from_scope: Scope }> {
    const params = new URLSearchParams();
    params.set("from_scope", fromScope);
    if (limit !== undefined) params.set("limit", String(limit));
    const response = await fetch(`${API_BASE}/learnings/promotion-candidates?${params}`);
    return handleResponse(response);
  },

  // Promote a learning
  async promoteLearning(
    id: string,
    toScope: Scope,
    promotedBy?: string
  ): Promise<Learning> {
    const response = await fetch(`${API_BASE}/learnings/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_scope: toScope, promoted_by: promotedBy || "web-ui" }),
    });
    return handleResponse(response);
  },

  // ==================== GRAPH ====================

  // Get full relationship graph
  async getGraph(options?: {
    scope?: Scope;
    type?: LearningType;
    limit?: number;
  }): Promise<RelationshipGraph> {
    const params = new URLSearchParams();
    if (options?.scope) params.set("scope", options.scope);
    if (options?.type) params.set("type", options.type);
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    const response = await fetch(`${API_BASE}/graph?${params}`);
    return handleResponse(response);
  },

  // Get connected graph for a learning
  async getConnectedGraph(id: string, depth?: number): Promise<RelationshipGraph> {
    const params = new URLSearchParams();
    if (depth !== undefined) params.set("depth", String(depth));
    const response = await fetch(`${API_BASE}/graph/${id}?${params}`);
    return handleResponse(response);
  },
};
