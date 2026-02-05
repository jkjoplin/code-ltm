import { Router, type Request, type Response, type NextFunction } from "express";
import type { LearningRepository } from "../../db/repository.js";
import { ScopeSchema, LearningTypeSchema } from "../../types.js";
import { createHttpError } from "../middleware/error-handler.js";
import { z } from "zod";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function graphRouter(repo: LearningRepository): Router {
  const router = Router();

  // GET /api/graph - Get full relationship graph
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const scope = req.query.scope as string | undefined;
      const type = req.query.type as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      // Validate if provided
      if (scope) ScopeSchema.parse(scope);
      if (type) LearningTypeSchema.parse(type);

      const graph = repo.getRelationshipGraph({
        scope: scope as "project" | "cross-project" | "global" | undefined,
        type: type as "gotcha" | "pattern" | "investigation" | "documentation" | "tip" | undefined,
        limit,
      });

      res.json(graph);
    })
  );

  // GET /api/graph/:id - Get connected graph for a learning
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const id = z.string().uuid().parse(req.params.id);
      const depth = parseInt(req.query.depth as string) || 2;

      const learning = repo.get(id);
      if (!learning) {
        throw createHttpError(404, "Learning not found");
      }

      const graph = repo.getConnectedLearnings(id, depth);
      res.json(graph);
    })
  );

  return router;
}
