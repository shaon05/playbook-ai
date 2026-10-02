import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../../config/env";
import { ApiError } from "../../errors/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const updateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(100) }).strict();

export function createMeRouter(env: ApiEnv, clientFactory?: (token: string) => SupabaseClient) {
  const router = Router();
  router.use(requireAuth(env, clientFactory));

  router.get("/", async (req, res, next) => {
    try {
      const { data, error } = await req.supabase!.from("profiles").select("id,display_name,avatar_url,created_at,updated_at").eq("id", req.auth!.id).maybeSingle();
      if (error) throw new ApiError(500, "PROFILE_LOOKUP_FAILED", "Unable to load the authenticated profile.");
      res.json({ data: { id: req.auth!.id, email: req.auth!.email ?? null, profile: data ?? null } });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/", async (req, res, next) => {
    try {
      const input = updateProfileSchema.parse(req.body);
      const { data, error } = await req.supabase!.from("profiles").update({ display_name: input.displayName }).eq("id", req.auth!.id).select("id,display_name,avatar_url,created_at,updated_at").single();
      if (error) throw new ApiError(500, "PROFILE_UPDATE_FAILED", "Unable to update the authenticated profile.");
      res.json({ data: { id: req.auth!.id, email: req.auth!.email ?? null, profile: data } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
