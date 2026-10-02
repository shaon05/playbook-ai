import { createClient } from "@supabase/supabase-js";
import type { ApiEnv } from "../config/env";

export function createSupabaseAdminClient(env: ApiEnv) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to run the extraction worker.");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
}
