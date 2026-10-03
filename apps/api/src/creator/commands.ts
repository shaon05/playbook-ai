import "dotenv/config";
import { z } from "zod";
import { loadEnv, type ApiEnv } from "../config/env";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

export type CreatorLookup = {
  userId?: string;
  email?: string;
};

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export function parseLookupArgs(args: string[]): CreatorLookup {
  const values: CreatorLookup = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if ((flag === "--email" || flag === "--user-id") && value && !value.startsWith("--")) {
      const cleanValue = value.trim().replace(/^<|>$/g, "");
      if (flag === "--email") values.email = cleanValue;
      else values.userId = cleanValue;
      index += 1;
    }
  }
  if ((values.email && values.userId) || (!values.email && !values.userId)) {
    throw new Error("Provide exactly one of --email or --user-id.");
  }
  if (values.userId) {
    const result = z.string().uuid().safeParse(values.userId);
    if (!result.success) throw new Error("--user-id must be a valid UUID. Do not include angle brackets.");
  }
  return values;
}

async function findUser(admin: SupabaseAdmin, lookup: CreatorLookup) {
  if (lookup.userId) {
    const { data, error } = await admin.auth.admin.getUserById(lookup.userId);
    if (error) throw new Error(`Supabase admin user lookup failed${error.status ? ` (${error.status})` : ""}: ${error.message}`);
    return data.user;
  }

  const target = lookup.email!.toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Supabase admin user lookup failed${error.status ? ` (${error.status})` : ""}: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function loadCreatorContext(env: ApiEnv, lookup: CreatorLookup) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for creator development commands.");
  const admin = createSupabaseAdminClient(env);
  const user = await findUser(admin, lookup);
  if (!user) return { admin, user: null, profile: null };
  const { data: profile, error } = await admin.from("creator_profiles").select("id,user_id,display_name,status").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Creator profile lookup failed${error.code ? ` (${error.code})` : ""}: ${error.message}`);
  return { admin, user, profile };
}

export function printStatus(user: { id: string; email?: string | null } | null, profile: { status: string } | null) {
  console.log(`User found: ${user ? "yes" : "no"}`);
  console.log(`Creator profile: ${profile ? "yes" : "no"}`);
  if (profile) console.log(`Creator status: ${profile.status}`);
}

export function loadCommandEnv() {
  return loadEnv();
}
