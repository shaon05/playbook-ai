import crypto from "node:crypto";
import type { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(JSON.stringify({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Number(durationMs.toFixed(2)) }));
  });
  next();
};
