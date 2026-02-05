import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("API Error:", err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: err.errors,
    });
    return;
  }

  if (err instanceof Error && "status" in err) {
    const apiErr = err as Error & { status: number };
    res.status(apiErr.status).json({
      error: apiErr.message,
    });
    return;
  }

  res.status(500).json({
    error: err instanceof Error ? err.message : "Internal server error",
  });
};

export function createHttpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}
