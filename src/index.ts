#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, getConfig } from "./config/index.js";
import { createDatabase } from "./db/schema.js";
import { LearningRepository } from "./db/repository.js";
import { EmbeddingService } from "./embeddings/index.js";
import {
  addLearningTool,
  handleAddLearning,
  getLearningTool,
  handleGetLearning,
  updateLearningTool,
  handleUpdateLearning,
  deleteLearningTool,
  handleDeleteLearning,
  listLearningsTool,
  handleListLearnings,
  searchLearningsTool,
  handleSearchLearnings,
  linkLearningsTool,
  handleLinkLearnings,
  reembedLearningsTool,
  handleReembedLearnings,
  addSuggestionTool,
  handleAddSuggestion,
  batchGetTool,
  handleBatchGet,
  addRuleTool,
  handleAddRule,
  getContextTool,
  handleGetContext,
  recallTool,
  handleRecall,
  getDigestTool,
  handleGetDigest,
  upsertLearningTool,
  handleUpsertLearning,
  recordLearningFeedbackTool,
  handleRecordLearningFeedback,
  runAutonomyCycleTool,
  handleRunAutonomyCycle,
} from "./tools/index.js";

// Load configuration first
loadConfig();
const config = getConfig();

// Initialize database and repository
const db = createDatabase();
const repo = new LearningRepository(db);

// Initialize embedding service with config
const embeddingService = new EmbeddingService(config.embeddings);

// Create MCP server
const server = new Server(
  {
    name: "code-ltm",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      addLearningTool,
      getLearningTool,
      updateLearningTool,
      deleteLearningTool,
      listLearningsTool,
      searchLearningsTool,
      linkLearningsTool,
      reembedLearningsTool,
      addSuggestionTool,
      batchGetTool,
      addRuleTool,
      getContextTool,
      recallTool,
      getDigestTool,
      upsertLearningTool,
      recordLearningFeedbackTool,
      runAutonomyCycleTool,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_learning":
        return handleAddLearning(repo, args);
      case "get_learning":
        return handleGetLearning(repo, args);
      case "update_learning":
        return handleUpdateLearning(repo, args);
      case "delete_learning":
        return handleDeleteLearning(repo, args);
      case "list_learnings":
        return handleListLearnings(repo, args);
      case "search_learnings":
        return handleSearchLearnings(repo, args);
      case "link_learnings":
        return handleLinkLearnings(repo, args);
      case "reembed_learnings":
        return handleReembedLearnings(repo, args);
      case "add_suggestion":
        return handleAddSuggestion(repo, args);
      case "batch_get":
        return handleBatchGet(repo, args);
      case "add_rule":
        return handleAddRule(repo, args);
      case "get_context":
        return handleGetContext(repo, args);
      case "recall":
        return handleRecall(repo, args);
      case "get_digest":
        return handleGetDigest(repo, args);
      case "upsert_learning":
        return handleUpsertLearning(repo, args);
      case "record_learning_feedback":
        return handleRecordLearningFeedback(repo, args);
      case "run_autonomy_cycle":
        return handleRunAutonomyCycle(repo, args);
      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Initialize embedding service before starting
  await embeddingService.initialize();
  repo.setEmbeddingService(embeddingService);
  const journalMode = db.pragma("journal_mode", { simple: true });
  const foreignKeys = db.pragma("foreign_keys", { simple: true });
  console.error(
    `DB self-check: journal_mode=${String(journalMode)}, foreign_keys=${String(foreignKeys)}`
  );
  console.error(
    `Embedding self-check: available=${embeddingService.isAvailable()} provider=${embeddingService.getActiveProvider() ?? "none"}`
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Code LTM MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
