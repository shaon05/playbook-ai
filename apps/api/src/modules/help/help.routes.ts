import { Router } from "express";
import { z } from "zod";
import type { ApiEnv } from "../../config/env";
import { requireAuth } from "../../middleware/auth.middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "../../lib/supabase";

export function createHelpRouter(env: ApiEnv) {
  const router = Router();
  const reportSchema = z.object({ reason: z.enum(["COPYRIGHT", "SPAM", "HARASSMENT", "INAPPROPRIATE", "MISLEADING", "OTHER"]), details: z.string().trim().max(5000).optional(), catalogContentId: z.string().uuid().optional(), creatorId: z.string().uuid().optional() }).strict();
  router.get("/articles", async (req, res, next) => {
    try { const query = z.string().trim().max(100).optional().parse(req.query.q); const client = createSupabaseClient(env); let request = client.from("help_articles").select("id,slug,title,category,body,audience,updated_at").eq("is_published", true); if (query) request = request.ilike("title", `%${query}%`); const { data, error } = await request.order("title"); if (error) throw error; res.json({ data: data ?? [] }); } catch (error) { next(error); }
  });
  router.post("/reports", async (req, res, next) => { try { const input = reportSchema.parse(req.body); const { data, error } = await createSupabaseClient(env).from("content_reports").insert({ reason: input.reason, details: input.details ?? null, catalog_content_id: input.catalogContentId ?? null, creator_id: input.creatorId ?? null, reporter_user_id: null }).select("id,reason,status,created_at").single(); if (error || !data) throw error ?? new Error("report"); res.status(201).json({ data }); } catch (error) { next(error); } });
  return router;
}

const ticketSchema = z.object({ category: z.enum(["ACCOUNT","UPLOAD","PROCESSING","AUDIO","SUBSCRIPTION","PAYMENT","CREATOR_SUBMISSION","CREATOR_ANALYTICS","CREATOR_EARNINGS","COPYRIGHT","BUG","OTHER"]), subject: z.string().trim().min(1).max(200), message: z.string().trim().min(1).max(5000), context: z.record(z.string(), z.string()).optional() }).strict();
const replySchema = z.object({ message: z.string().trim().min(1).max(5000) }).strict();

export function createSupportRouter(env: ApiEnv, clientFactory?: (token: string) => SupabaseClient) {
  const router = Router(); router.use(requireAuth(env, clientFactory));
  router.get("/tickets", async (req, res, next) => { try { const { data, error } = await req.supabase!.from("support_tickets").select("id,category,subject,status,priority,created_at,updated_at,resolved_at").eq("user_id", req.auth!.id).order("updated_at", { ascending: false }); if (error) throw error; res.json({ data: data ?? [] }); } catch (error) { next(error); } });
  router.post("/tickets", async (req, res, next) => { try { const input = ticketSchema.parse(req.body); const { data: ticket, error } = await req.supabase!.from("support_tickets").insert({ user_id: req.auth!.id, category: input.category, subject: input.subject }).select("id,category,subject,status,priority,created_at,updated_at").single(); if (error || !ticket) throw error ?? new Error("ticket"); const message = input.context ? `${input.message}\n\nContext: ${JSON.stringify(input.context)}` : input.message; const { error: messageError } = await req.supabase!.from("support_messages").insert({ ticket_id: ticket.id, sender_type: "USER", sender_user_id: req.auth!.id, message }); if (messageError) throw messageError; res.status(201).json({ data: ticket }); } catch (error) { next(error); } });
  router.get("/tickets/:ticketId", async (req, res, next) => { try { const id = z.string().uuid().parse(req.params.ticketId); const { data: ticket, error } = await req.supabase!.from("support_tickets").select("id,category,subject,status,priority,created_at,updated_at,resolved_at").eq("id", id).eq("user_id", req.auth!.id).maybeSingle(); if (error || !ticket) return res.status(404).json({ error: { code: "TICKET_NOT_FOUND", message: "Support request not found." } }); const { data: messages } = await req.supabase!.from("support_messages").select("id,sender_type,message,created_at").eq("ticket_id", id).order("created_at"); res.json({ data: { ticket, messages: messages ?? [] } }); } catch (error) { next(error); } });
  router.post("/tickets/:ticketId/messages", async (req, res, next) => { try { const id = z.string().uuid().parse(req.params.ticketId); const input = replySchema.parse(req.body); const { data, error } = await req.supabase!.from("support_messages").insert({ ticket_id: id, sender_type: "USER", sender_user_id: req.auth!.id, message: input.message }).select("id,sender_type,message,created_at").single(); if (error || !data) throw error ?? new Error("message"); res.status(201).json({ data }); } catch (error) { next(error); } });
  router.post("/tickets/:ticketId/close", async (req, res, next) => { try { const id = z.string().uuid().parse(req.params.ticketId); const { data, error } = await req.supabase!.from("support_tickets").update({ status: "CLOSED", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", req.auth!.id).select("id,status,updated_at").single(); if (error || !data) throw new Error("ticket"); res.json({ data }); } catch (error) { next(error); } });
  return router;
}
