import type { NextFunction, Request, Response } from "express";
import type { ApiEnv } from "../config/env";
import { ApiError } from "../errors/api-error";

export interface UploadRateLimitStore { consume(userId: string, limit: number): Promise<boolean>; }

class DevelopmentMemoryRateLimitStore implements UploadRateLimitStore {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();
  async consume(userId: string, limit: number) {
    const now = Date.now();
    const current = this.windows.get(userId);
    const window = current && now - current.startedAt < 60 * 60 * 1000 ? current : { startedAt: now, count: 0 };
    window.count += 1;
    this.windows.set(userId, window);
    return window.count <= limit;
  }
}

export function createUploadRateLimitStore(env: ApiEnv, sharedClient?: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: boolean | null; error: { message?: string } | null }> }): UploadRateLimitStore {
  if (env.NODE_ENV === "production") {
    if (!sharedClient) throw new Error("A shared rate-limit store is required in production.");
    return { consume: async (userId, limit) => { const { data, error } = await sharedClient.rpc("consume_api_rate_limit", { p_user_id: userId, p_scope: "private_upload", p_limit: limit, p_window_seconds: 3600 }); if (error) throw new Error(error.message ?? "RATE_LIMIT_STORE_FAILED"); return data === true; } };
  }
  return new DevelopmentMemoryRateLimitStore();
}

export function uploadRateLimit(env: ApiEnv, store?: UploadRateLimitStore) {
  const selectedStore = store ?? createUploadRateLimitStore(env);
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.auth?.id;
      if (!userId) return next();
      if (!await selectedStore.consume(userId, env.UPLOAD_RATE_LIMIT_PER_HOUR ?? 30)) return next(new ApiError(429, "UPLOAD_RATE_LIMITED", "Upload limit reached. Please try again later."));
      next();
    } catch (error) {
      console.error(JSON.stringify({ event: "upload_rate_limit_failed", stage: "rate_limit", status: 503, code: "UPLOAD_RATE_LIMIT_UNAVAILABLE", message: error instanceof Error ? error.message : "shared rate-limit store unavailable" }));
      next(new ApiError(503, "UPLOAD_RATE_LIMIT_UNAVAILABLE", "Upload protection is temporarily unavailable. Please try again shortly."));
    }
  };
}
