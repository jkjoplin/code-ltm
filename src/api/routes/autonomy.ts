import { Router, type Request, type Response, type NextFunction } from "express";
import type { LearningRepository } from "../../db/repository.js";
import { runAutonomyCycle } from "../../autonomy/index.js";
import { RunAutonomyCycleInputSchema } from "../../types.js";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function autonomyRouter(repo: LearningRepository): Router {
  const router = Router();

  router.post(
    "/run",
    asyncHandler(async (req, res) => {
      const input = RunAutonomyCycleInputSchema.parse(req.body);
      const result = await runAutonomyCycle(repo, input);
      res.json(result);
    })
  );

  router.get(
    "/runs",
    asyncHandler(async (req, res) => {
      const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 200);
      const runs = repo.listAutonomyRuns(limit);
      res.json({ runs, count: runs.length });
    })
  );

  return router;
}
