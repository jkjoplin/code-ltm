# Agent Knowledge Store - Master Plan

**Project Name**: `code-ltm` (formerly `agent-knowledge`)

A knowledge management system for AI coding agents to record, share, and retrieve learnings across projects.

## Research Sources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK
- [sqlite-vec](https://github.com/asg017/sqlite-vec) - Vector search for SQLite
- [Ollama Embedding Models](https://ollama.com/blog/embedding-models) - Local embeddings
- [Agent Memory Patterns](https://www.marktechpost.com/2025/07/26/how-memory-transforms-ai-agents-insights-and-leading-solutions-in-2025/) - Memory architecture research

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| MCP Server | TypeScript + Official SDK | Fastest development, best MCP tooling |
| Database | SQLite + sqlite-vec | Portable, zero-config, vector search built-in |
| Embeddings | Ollama (nomic-embed-text) | Local-first, fast, no API costs |
| Fallback Embeddings | OpenAI/Voyage API | For users without Ollama |
| Web UI | React + Vite + Tailwind | Fast dev iteration, modern DX |
| Validation | Zod | Runtime validation + TypeScript types |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agents                                │
│                    (Claude, Cursor, etc.)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MCP Protocol (STDIO)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server (TypeScript)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Tools       │  │ Embedding   │  │ Query Engine            │  │
│  │ - search    │  │ Service     │  │ - semantic search       │  │
│  │ - add       │  │ - Ollama    │  │ - keyword/tag filter    │  │
│  │ - update    │  │ - Cloud API │  │ - scope filtering       │  │
│  │ - delete    │  │             │  │ - relevance ranking     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQLite + sqlite-vec                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ learnings   │  │ file_refs   │  │ learning_vectors        │  │
│  │ table       │  │ table       │  │ (sqlite-vec virtual)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Shared DB file
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Web UI (React + Vite)                       │
│  - Browse/search learnings                                       │
│  - Edit/delete with confirmation                                 │
│  - Approve/reject agent suggestions                              │
│  - Export/import                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Schema

### Learning Entry
```typescript
interface Learning {
  id: string;                    // UUID
  title: string;                 // Short summary (for list views)
  content: string;               // Full content (markdown)
  type: LearningType;            // gotcha | pattern | investigation | documentation | tip
  scope: Scope;                  // project | cross-project | global
  project_path?: string;         // For project-scoped (e.g., "/Users/x/myproject")
  tags: string[];                // Searchable tags
  file_references: FileRef[];    // Links to relevant code
  related_ids: string[];         // Links to related learnings
  confidence: Confidence;        // low | medium | high
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  created_by: string;            // Agent identifier
  version: number;               // For optimistic locking
}

interface FileRef {
  path: string;                  // Relative or absolute path
  line_start?: number;
  line_end?: number;
  snippet?: string;              // Optional code snippet for context
}
```

## MCP Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `search_learnings` | Find relevant learnings | `query`, `scope`, `tags`, `type`, `limit` |
| `get_learning` | Get single learning by ID | `id` |
| `add_learning` | Create new learning | Full learning object |
| `update_learning` | Modify existing | `id`, partial update |
| `delete_learning` | Remove learning | `id` |
| `list_learnings` | List with filters | `scope`, `tags`, `type`, `project_path` |
| `link_learnings` | Create relationship | `source_id`, `target_id` |

### Search Behavior (Context-Efficient)
- Returns **summaries by default** (id, title, type, tags, relevance_score)
- Agent calls `get_learning` for full content only when needed
- Supports `include_content: true` for immediate full results
- Max 20 results by default, configurable

---

## Implementation Phases

### Phase 1: Core MCP Server ✅ COMPLETE
**Goal**: Working MCP server with basic CRUD operations (no semantic search yet)

**Deliverables**:
- [x] Project setup (TypeScript, ESLint, Prettier)
- [x] SQLite database schema and migrations
- [x] Basic MCP server with STDIO transport
- [x] CRUD tools: `add_learning`, `get_learning`, `update_learning`, `delete_learning`
- [x] `list_learnings` with basic filtering (scope, tags, type)
- [x] Keyword search (LIKE queries)
- [x] Unit tests for core operations

**Files created**:
- `package.json`, `tsconfig.json`, `eslint.config.js`
- `src/index.ts` - MCP server entry point
- `src/db/schema.ts` - Database schema
- `src/db/repository.ts` - Database operations
- `src/tools/` - Individual tool implementations
- `src/types.ts` - Shared TypeScript types (Zod schemas)

---

### Phase 2: Semantic Search ✅ COMPLETE
**Goal**: Add embedding generation and vector search

**Deliverables**:
- [x] Ollama integration for local embeddings
- [x] Fallback to OpenAI/Voyage API
- [x] sqlite-vec integration
- [x] Automatic embedding on add/update
- [x] `search_learnings` with semantic ranking
- [x] Hybrid search (semantic + keyword boosting)
- [x] Re-embedding tool for bulk updates (`reembed_learnings`)

**Files created**:
- `src/embeddings/ollama-provider.ts` - Ollama client
- `src/embeddings/openai-provider.ts` - OpenAI fallback
- `src/embeddings/embedding-service.ts` - Unified embedding service
- `src/embeddings/types.ts` - Embedding provider types
- `src/embeddings/index.ts` - Module exports
- `src/tools/reembed.ts` - Bulk re-embedding tool
- `src/db/schema.ts` - Updated with sqlite-vec virtual table (migration 002)

---

### Phase 3: Web UI ✅ COMPLETE
**Goal**: Human interface for transparency and control

**Deliverables**:
- [x] React + Vite project setup
- [x] Browse learnings (list view with filters)
- [x] Search interface (keyword, semantic, hybrid modes)
- [x] View learning detail
- [x] Edit/delete with confirmation
- [x] Export to JSON
- [x] Import from JSON

**Files created**:
- `ui/` - React + Vite + Tailwind project
- `ui/src/components/` - SearchBar, FilterPanel, LearningCard, LearningList, LearningDetail, LearningForm
- `ui/src/hooks/` - useLearnings, useSearch, useGraph
- `ui/src/pages/` - HomePage, LearningPage, SettingsPage, GraphPage, PromotionPage
- `ui/src/api/client.ts` - API client
- `src/api/` - REST API server for UI
- `src/api/routes/learnings.ts` - CRUD and search endpoints
- `src/api/routes/graph.ts` - Relationship graph endpoints

**Note**: UI communicates via REST API (`src/api/`) which shares the SQLite database with MCP server

---

### Phase 4: Advanced Features ⏳ IN PROGRESS
**Goal**: Polish and power-user features

**Deliverables**:
- [x] Version history for learnings (migration 003, API endpoints, VersionHistory component)
- [x] Relationship visualization (graph view - GraphPage, RelationshipGraph, MiniGraph components)
- [x] Cross-project knowledge promotion (PromotionPage, PromoteButton, PromotionDialog)
- [x] Conflict detection (similar learnings - SimilarLearnings, DuplicateWarning components)
- [ ] CLI tool for manual operations
- [ ] Configuration file support (`.code-ltm.yaml`)

**Note**: Agent suggestion queue removed from scope - using direct write model per design decision

---

### Phase 5: Distribution & Integration
**Goal**: Easy installation and integration

**Deliverables**:
- [ ] NPM package for MCP server
- [ ] Homebrew formula (macOS)
- [ ] Documentation site
- [ ] Claude Desktop integration guide
- [ ] Cursor integration guide
- [ ] Example CLAUDE.md instructions for agents

---

## Key Design Decisions

### 1. Single SQLite File
- MCP server and Web UI share the same database
- Located at `~/.code-ltm/knowledge.db` by default
- Configurable via `CODE_LTM_DB` environment variable

### 2. Scope Hierarchy
- **Global**: Available to all projects (e.g., "Always use `const` over `let` in TypeScript")
- **Cross-project**: Shared across related projects (e.g., "Our monorepo uses pnpm workspaces")
- **Project**: Specific to one project (e.g., "The auth module uses JWT with RS256")

### 3. Embedding Strategy
- Generate on write (add/update)
- Use nomic-embed-text (768 dimensions) via Ollama
- Store in sqlite-vec virtual table
- Fallback to cloud API if Ollama unavailable

### 4. Context Window Efficiency
- Search returns summaries by default
- Agents fetch full content only when needed
- Relevance scores help agents prioritize
- Configurable result limits

---

## Verification Plan

### Phase 1 Verification
```bash
# Run MCP server
npm run dev

# Test with MCP inspector
npx @anthropic/mcp-inspector

# Verify tools work:
# - add_learning → creates entry
# - get_learning → retrieves it
# - list_learnings → shows in list
# - update_learning → modifies it
# - delete_learning → removes it
```

### Phase 2 Verification
```bash
# Ensure Ollama is running with nomic-embed-text
ollama pull nomic-embed-text
ollama serve

# Test semantic search
# - Add learning about "React hooks"
# - Search for "useState patterns" → should find it
# - Search for "database migrations" → should NOT find it
```

### Phase 3 Verification
```bash
# Start UI
cd ui && npm run dev

# Manual testing:
# - Browse learnings
# - Search works
# - Edit a learning
# - Delete a learning
# - Export to JSON
```

---

## Confirmed Design Decisions

1. **Approval workflow**: Direct write
   - Agents write immediately without approval queue
   - Humans have full control via UI (edit, delete, review anytime)
   - Keeps agent workflow frictionless

2. **Project identification**: Git root path
   - Use git repository root as project identifier
   - Portable across machines (relative paths stored)
   - Fallback to cwd if not in a git repo

3. **Development priority**: Core features solid first
   - Focus on search quality, reliability, good UX
   - Phase 4+ features come after core is rock-solid

4. **Embedding model**: nomic-embed-text
   - Best balance of speed and quality
   - 768 dimensions, works well with sqlite-vec

5. **Sync**: Out of scope for v1
   - Single SQLite file enables easy Dropbox/iCloud sync if desired
