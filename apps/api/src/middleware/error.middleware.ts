import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { ApiError } from "../errors/api-error";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", "The requested resource was not found."));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.issues.map((issue: z.ZodIssue) => ({ path: issue.path, message: issue.message })) } });
    return;
  }
  if (error instanceof ApiError) {
    console.error(JSON.stringify({ event: "api_request_error", code: error.code, status: error.statusCode, message: error.message }));
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  console.error(JSON.stringify({ event: "api_error", requestId: res.getHeader("X-Request-Id"), method: req.method, path: req.path, message: error instanceof Error ? error.message : "Unknown error", name: error instanceof Error ? error.name : typeof error }));
  res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } });
};
