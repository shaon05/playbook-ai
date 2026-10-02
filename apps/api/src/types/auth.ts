import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      supabase?: SupabaseClient;
    }
  }
}
