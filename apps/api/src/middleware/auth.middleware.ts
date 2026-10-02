import type { NextFunction, Request, Response } from "express";
import type { ApiEnv } from "../config/env";
import { ApiError } from "../errors/api-error";
import { createSupabaseClient } from "../lib/supabase";

export function requireAuth(env: ApiEnv, clientFactory = (token: string) => createSupabaseClient(env, token)) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authorization = req.header("authorization");
      const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
      if (!match) {
        throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
      }

      const requestClient = clientFactory(match[1]);
      const { data, error } = await requestClient.auth.getUser(match[1]);
      if (error || !data.user) {
        throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired authentication token.");
      }

      req.auth = { id: data.user.id, email: data.user.email ?? undefined };
      req.supabase = requestClient;
      next();
    } catch (error) {
      next(error);
    }
  };
}
