import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApiEnv } from "../config/env";

export function createSupabaseClient(env: ApiEnv, accessToken?: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
}
