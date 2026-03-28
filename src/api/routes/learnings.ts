import { Router, type Request, type Response, type NextFunction } from "express";
import type { LearningRepository } from "../../db/repository.js";
import {
  AddLearningInputSchema,
  UpdateLearningInputSchema,
  UpsertLearningInputSchema,
  RecordLearningFeedbackInputSchema,
  LearningTypeSchema,
  ScopeSchema,
  SearchModeSchema,
} from "../../types.js";
import type { LearningType } from "../../types.js";
import { v4 as uuidv4 } from "uuid";
import { createHttpError } from "../middleware/error-handler.js";
import { z } from "zod";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function learningsRouter(repo: LearningRepository): Router {
  const router = Router();

  // GET /api/learnings - List learnings with filters
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const scope = req.query.scope as string | undefined;
      const type = req.query.type as string | undefined;
      const tagsParam = req.query.tags as string | string[] | undefined;
      const projectPath = req.query.project_path as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Parse tags: accept comma-separated or array
      let tags: string[] | undefined;
      if (tagsParam) {
        if (Array.isArray(tagsParam)) {
          tags = tagsParam;
        } else if (typeof tagsParam === "string") {
          tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

      // Validate enum values if provided
      if (scope) ScopeSchema.parse(scope);
      if (type) LearningTypeSchema.parse(type);

      const learnings = repo.list({
        scope: scope as "project" | "cross-project" | "global" | undefined,
        type: type as LearningType | undefined,
        tags,
        project_path: projectPath,
        limit: Math.min(limit, 100),
        offset,
      });

      res.json({ learnings, limit, offset });
    })
  );

  // GET /api/learnings/search - Search learnings
  router.get(
    "/search",
    asyncHandler(async (req, res) => {
      const query = req.query.query as string;
      if (!query) {
        throw createHttpError(400, "Query parameter is required");
      }

      const scope = req.query.scope as string | undefined;
      const type = req.query.type as string | undefined;
      const tagsParam = req.query.tags as string | string[] | undefined;
      const projectPath = req.query.project_path as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const mode = (req.query.mode as string) || "hybrid";
      const parsedWeight = Number.parseFloat(req.query.semantic_weight as string);
      const semanticWeight = Number.isNaN(parsedWeight)
        ? 0.5
        : Math.max(0, Math.min(1, parsedWeight));

      // Parse tags
      let tags: string[] | undefined;
      if (tagsParam) {
        if (Array.isArray(tagsParam)) {
          tags = tagsParam;
        } else if (typeof tagsParam === "string") {
          tags = tagsParam.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

      // Validate enum values
      if (scope) ScopeSchema.parse(scope);
      if (type) LearningTypeSchema.parse(type);
      SearchModeSchema.parse(mode);

      const learnings = await repo.hybridSearch({
        query,
        scope: scope as "project" | "cross-project" | "global" | undefined,
        type: type as LearningType | undefined,
        tags,
        project_path: projectPath,
        limit: Math.min(limit, 100),
        mode: mode as "keyword" | "semantic" | "hybrid",
        semantic_weight: semanticWeight,
      });

      if (learnings.length > 0) {
        repo.recordAccess(learnings.map((l) => l.id));
      }

      res.json({
        learnings,
        query,
        mode,
        semantic_available: repo.isSemanticSearchAvailable(),
      });
    })
  );

  // POST /api/learnings/check-similarity - Check text for similar learnings
  // NOTE: This must be BEFORE /:id routes to avoid being matched as an ID
  router.post(
    "/check-similarity",
    asyncHandler(async (req, res) => {
      const { title, content } = req.body;
      if (!title && !content) {
        throw createHttpError(400, "Either title or content is required");
      }

      const text = [title, content].filter(Boolean).join("\n\n");
      const threshold = parseFloat(req.query.threshold as string) || 0.7;
      const limit = parseInt(req.query.limit as string) || 5;

      const similar = await repo.findSimilar(text, undefined, threshold, limit);
      res.json({ similar, threshold });
    })
  );

  // GET /api/learnings/promotion-candidates - Get promotion candidates
  // NOTE: This must be BEFORE /:id routes to avoid being matched as an ID
  router.get(
    "/promotion-candidates",
    asyncHandler(async (req, res) => {
      const fromScope = req.query.from_scope as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!fromScope) {
        throw createHttpError(400, "from_scope is required");
      }
      ScopeSchema.parse(fromScope);

      const candidates = repo.getPromotionCandidates(
        fromScope as "project" | "cross-project" | "global",
        limit
      );

      res.json({ candidates, from_scope: fromScope });
    })
  );

  // GET /api/learnings/hot - Hot paths (most accessed + useful)
  // NOTE: Must be BEFORE /:id routes
  router.get(
    "/hot",
    asyncHandler(async (req, res) => {
      const limit = parseInt(req.query.limit as string) || 10;
      const projectPath = req.query.project_path as string | undefined;
      const type = req.query.type as string | undefined;

      if (type) LearningTypeSchema.parse(type);

      const learnings = repo.hotPaths({
        limit: Math.min(limit, 50),
        project_path: projectPath,
        type: type as LearningType | undefined,
      });

      res.json({ count: learnings.length, learnings });
    })
  );

  // GET /api/learnings/prune_candidates - Get prune candidates
  // NOTE: Must be BEFORE /:id routes
  router.get(
    "/prune_candidates",
    asyncHandler(async (req, res) => {
      const projectPath = req.query.project_path as string | undefined;
      const candidates = repo.getPruneCandidates(projectPath);
      res.json({ candidates });
    })
  );

  // POST /api/learnings - Create new learning
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = AddLearningInputSchema.parse(req.body);
      const learning = repo.add(input);
      res.status(201).json(learning);
    })
  );

  // POST /api/learnings/batch_add - Add multiple learnings
  router.post(
    "/batch_add",
    asyncHandler(async (req, res) => {
      const { learnings: inputs } = req.body;
      if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 50) {
        throw createHttpError(400, "learnings array required (1-50 items)");
      }

      const ids: string[] = [];
      const titles: string[] = [];
      for (const input of inputs) {
        const parsed = AddLearningInputSchema.parse(input);
        const learning = repo.add(parsed);
        ids.push(learning.id);
        titles.push(learning.title);
      }

      res.status(201).json({ added: ids.length, ids, titles });
    })
  );

  // POST /api/learnings/session_init - Initialize a session
  router.post(
    "/session_init",
    asyncHandler(async (req, res) => {
      const { project_path: projectPath, files, task } = req.body;
      if (!projectPath) {
        throw createHttpError(400, "project_path is required");
      }

      const sessionId = uuidv4();
      repo.createSession(sessionId, projectPath, task, files);

      const allRules = repo.list({
        type: "rule",
        limit: 100,
        offset: 0,
        include_deprecated: false,
      });

      const hot = repo.hotPaths({ limit: 5, project_path: projectPath });

      let relevant: Array<{ id: string; title: string; type: string }> = [];
      const query = [task, ...(files ?? [])].filter(Boolean).join(" ");
      if (query) {
        const searchResults = await repo.hybridSearch({
          query,
          project_path: projectPath,
          limit: 10,
          mode: "hybrid",
          semantic_weight: 0.5,
        });
        relevant = searchResults.map((s) => ({
          id: s.id,
          title: s.title,
          type: s.type,
        }));
      }

      res.status(201).json({ session_id: sessionId, rules: allRules, hot, relevant });
    })
  );

  // POST /api/learnings/upsert - Upsert learning (additive API)
  router.post(
    "/upsert",
    asyncHandler(async (req, res) => {
      const input = UpsertLearningInputSchema.parse(req.body);
      const result = repo.upsert(input, "api");
      res.status(result.created ? 201 : 200).json(result);
    })
  );

  // GET /api/learnings/:id - Get single learning
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);

      const learning = repo.get(id);
      if (!learning) {
        throw createHttpError(404, "Learning not found");
      }

      res.json(learning);
    })
  );

  // PATCH /api/learnings/:id - Update learning
  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);

      const input = UpdateLearningInputSchema.parse({ ...req.body, id });
      const learning = repo.update(input);
      if (!learning) {
        throw createHttpError(404, "Learning not found");
      }

      res.json(learning);
    })
  );

  // DELETE /api/learnings/:id - Delete learning
  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);

      const deleted = repo.delete(id);
      if (!deleted) {
        throw createHttpError(404, "Learning not found");
      }

      res.status(204).send();
    })
  );

  // POST /api/learnings/:id/link/:targetId - Link two learnings
  router.post(
    "/:id/link/:targetId",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const targetId = z.string().uuid().parse(req.params.targetId);

      const linked = repo.linkLearnings(id, targetId);
      if (!linked) {
        throw createHttpError(404, "One or both learnings not found");
      }

      res.json({ success: true, source_id: id, target_id: targetId });
    })
  );

  // POST /api/learnings/:id/feedback - Record learning feedback
  router.post(
    "/:id/feedback",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const input = RecordLearningFeedbackInputSchema.parse({
        ...req.body,
        id,
      });
      const metrics = repo.recordFeedback(
        input.id,
        input.outcome,
        input.source,
        input.context
      );
      if (!metrics) {
        throw createHttpError(404, "Learning not found");
      }
      res.status(201).json({ success: true, metrics });
    })
  );

  // ==================== VERSION HISTORY ENDPOINTS ====================

  // GET /api/learnings/:id/versions - Get version history
  router.get(
    "/:id/versions",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;

      const learning = repo.get(id);
      if (!learning) {
        throw createHttpError(404, "Learning not found");
      }

      const versions = repo.getVersionHistory(id, limit);
      const count = repo.getVersionCount(id);

      res.json({ versions, count });
    })
  );

  // GET /api/learnings/:id/versions/:version - Get specific version
  router.get(
    "/:id/versions/:version",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const versionParam = req.params.version;
      if (!versionParam) {
        throw createHttpError(400, "Version parameter is required");
      }
      const version = parseInt(versionParam);

      if (isNaN(version) || version < 1) {
        throw createHttpError(400, "Invalid version number");
      }

      const versionData = repo.getVersion(id, version);
      if (!versionData) {
        throw createHttpError(404, "Version not found");
      }

      res.json(versionData);
    })
  );

  // POST /api/learnings/:id/rollback/:version - Rollback to version
  router.post(
    "/:id/rollback/:version",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const versionParam = req.params.version;
      if (!versionParam) {
        throw createHttpError(400, "Version parameter is required");
      }
      const version = parseInt(versionParam);
      const changedBy = (req.body.changed_by as string) || "web-ui";

      if (isNaN(version) || version < 1) {
        throw createHttpError(400, "Invalid version number");
      }

      const learning = repo.rollbackToVersion(id, version, changedBy);
      if (!learning) {
        throw createHttpError(404, "Learning or version not found");
      }

      res.json(learning);
    })
  );

  // ==================== SIMILARITY/CONFLICT DETECTION ENDPOINTS ====================

  // GET /api/learnings/:id/similar - Find similar learnings
  router.get(
    "/:id/similar",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const threshold = parseFloat(req.query.threshold as string) || 0.7;
      const limit = parseInt(req.query.limit as string) || 5;

      const learning = repo.get(id);
      if (!learning) {
        throw createHttpError(404, "Learning not found");
      }

      const similar = await repo.checkForDuplicates(id, threshold);
      res.json({ similar, threshold, limit });
    })
  );

  // ==================== PROMOTION ENDPOINTS ====================

  // POST /api/learnings/:id/promote - Promote a learning
  router.post(
    "/:id/promote",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const toScope = req.body.to_scope as string;
      const promotedBy = (req.body.promoted_by as string) || "web-ui";

      if (!toScope) {
        throw createHttpError(400, "to_scope is required");
      }
      ScopeSchema.parse(toScope);

      const learning = repo.promoteLearning(
        id,
        toScope as "project" | "cross-project" | "global",
        promotedBy
      );
      if (!learning) {
        throw createHttpError(400, "Cannot promote learning (not found or invalid promotion)");
      }

      res.json(learning);
    })
  );

  return router;
}
