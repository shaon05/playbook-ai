import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../../config/env";
import { ApiError } from "../../errors/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const sessionSchema = z.object({ catalogContentId: z.string().uuid() }).strict();
const progressSchema = z.object({ listeningSecondsDelta: z.number().int().min(0).max(300), progressPercent: z.number().min(0).max(100) }).strict();
export const listeningRules = { minimumQualifiedSeconds: 30, minimumQualifiedPercent: 10, completionPercent: 90 } as const;

export function createListeningRouter(env: ApiEnv, clientFactory?: (token: string) => SupabaseClient) {
  const router = Router(); router.use(requireAuth(env, clientFactory));
  router.post("/sessions", async (req, res, next) => { try { const input = sessionSchema.parse(req.body); const { data: content } = await req.supabase!.from("catalog_content").select("id").eq("id", input.catalogContentId).eq("status", "PUBLISHED").eq("visibility", "PUBLIC").maybeSingle(); if (!content) throw new ApiError(404, "CONTENT_NOT_FOUND", "Story not found."); const { data, error } = await req.supabase!.from("listening_sessions").insert({ user_id: req.auth!.id, catalog_content_id: input.catalogContentId }).select("id,catalog_content_id,started_at,listening_seconds,max_progress_percent,qualified,completed").single(); if (error || !data) throw new ApiError(500, "LISTENING_SESSION_FAILED", "Unable to start listening session."); res.status(201).json({ data }); } catch (error) { next(error); } });
  router.patch("/sessions/:sessionId", async (req, res, next) => { try { const id = z.string().uuid().parse(req.params.sessionId); const input = progressSchema.parse(req.body); const { data: current } = await req.supabase!.from("listening_sessions").select("id,listening_seconds,max_progress_percent,qualified,completed").eq("id", id).eq("user_id", req.auth!.id).maybeSingle(); if (!current) throw new ApiError(404, "LISTENING_SESSION_NOT_FOUND", "Listening session not found."); const seconds = current.listening_seconds + input.listeningSecondsDelta; const progress = Math.max(Number(current.max_progress_percent), input.progressPercent); const qualified = current.qualified || seconds >= listeningRules.minimumQualifiedSeconds || progress >= listeningRules.minimumQualifiedPercent; const completed = current.completed || progress >= listeningRules.completionPercent; const { data, error } = await req.supabase!.from("listening_sessions").update({ listening_seconds: seconds, max_progress_percent: progress, qualified, completed, completed_at: completed ? new Date().toISOString() : null, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", req.auth!.id).select("id,listening_seconds,max_progress_percent,qualified,completed").single(); if (error || !data) throw new ApiError(500, "LISTENING_SESSION_UPDATE_FAILED", "Unable to update listening session."); res.json({ data }); } catch (error) { next(error); } });
  return router;
}
