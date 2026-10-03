import "dotenv/config";
import { loadEnv } from "../config/env";
import { createSupabaseAdminClient } from "../lib/supabase-admin";
import { applyFollowEvent } from "./semantics";

type Metric = { impressions: number; opens: number; play_starts: number; qualified_listens: number; qualified_listening_seconds: number; unique_listeners: number; listening_seconds: number; completions: number; average_completion_percent: number; favorites_added: number; shares: number; followers_gained: number; current_favorites: number; current_followers: number };
const empty = (): Metric => ({ impressions: 0, opens: 0, play_starts: 0, qualified_listens: 0, qualified_listening_seconds: 0, unique_listeners: 0, listening_seconds: 0, completions: 0, average_completion_percent: 0, favorites_added: 0, shares: 0, followers_gained: 0, current_favorites: 0, current_followers: 0 });

export async function aggregateDate(date = process.env.ANALYTICS_DATE ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
  const env = loadEnv();
  const admin = createSupabaseAdminClient(env);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { data: content, error: contentError } = await admin.from("catalog_content").select("id,creator_id").not("creator_id", "is", null).eq("status", "PUBLISHED").eq("visibility", "PUBLIC");
  if (contentError) throw contentError;
  for (const item of content ?? []) {
    const metric = empty();
    const { data: events, error: eventsError } = await admin.from("user_content_events").select("event_type,user_id").eq("catalog_content_id", item.id).gte("created_at", start).lte("created_at", end);
    if (eventsError) throw eventsError;
    const listeners = new Set<string>(); const followedUsers = new Set<string>();
    for (const event of events ?? []) {
      const key = event.event_type.toLowerCase();
      if (key === "impression") metric.impressions += 1;
      if (key === "open") metric.opens += 1;
      if (key === "play_start") metric.play_starts += 1;
      if (key === "qualified_listen") metric.qualified_listens += 1;
      if (key === "complete") metric.completions += 1;
      if (key === "favorite") metric.favorites_added += 1;
      if (key === "share") metric.shares += 1;
      if (key === "follow_creator" || key === "unfollow_creator") applyFollowEvent(followedUsers, event.event_type, event.user_id);
      if (event.user_id) listeners.add(event.user_id);
    }
    const { data: sessions, error: sessionError } = await admin.from("listening_sessions").select("user_id,listening_seconds,qualified,completed,max_progress_percent").eq("catalog_content_id", item.id).gte("updated_at", start).lte("updated_at", end);
    if (sessionError) throw sessionError;
    let completionTotal = 0;
    for (const session of sessions ?? []) { metric.listening_seconds += session.listening_seconds ?? 0; completionTotal += Number(session.max_progress_percent ?? 0); if (session.qualified) { metric.qualified_listens += 1; metric.qualified_listening_seconds += session.listening_seconds ?? 0; } if (session.completed) metric.completions += 1; if (session.user_id) listeners.add(session.user_id); }
    metric.unique_listeners = listeners.size; metric.followers_gained = followedUsers.size;
    metric.average_completion_percent = sessions?.length ? Number((completionTotal / sessions.length).toFixed(2)) : 0;
    const { count: favorites } = await admin.from("user_catalog_favorites").select("user_id", { count: "exact", head: true }).eq("catalog_content_id", item.id);
    const { count: followers } = await admin.from("creator_follows").select("follower_user_id", { count: "exact", head: true }).eq("creator_id", item.creator_id);
    metric.current_favorites = favorites ?? 0; metric.current_followers = followers ?? 0;
    const { error: upsertError } = await admin.from("creator_content_analytics_daily").upsert({ date, creator_id: item.creator_id, catalog_content_id: item.id, ...metric, updated_at: new Date().toISOString() }, { onConflict: "date,creator_id,catalog_content_id" });
    if (upsertError) throw upsertError;
  }
  return { date, contentCount: content?.length ?? 0 };
}

if (process.argv[1]?.endsWith("aggregate.ts")) aggregateDate().then((result) => console.log(JSON.stringify({ event: "analytics_aggregated", ...result }))).catch((error) => { console.error(JSON.stringify({ event: "analytics_aggregation_failed", message: error instanceof Error ? error.message : "Unknown error" })); process.exitCode = 1; });
