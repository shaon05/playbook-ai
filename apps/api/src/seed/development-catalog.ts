import "dotenv/config";
import { loadEnv } from "../config/env";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

async function seed() {
  const env = loadEnv();
  if (env.NODE_ENV !== "development" || env.DEV_SEED_CATALOG !== "true") throw new Error("Development catalog seed requires NODE_ENV=development and DEV_SEED_CATALOG=true.");
  const admin = createSupabaseAdminClient(env);
  const rows = [
    { id: "00000000-0000-4000-8000-000000000001", title: "The Last Lantern", author_display_name: "Mira Sen", description: "A fictional mystery about memory and a vanished coastal town.", language: "en", status: "PUBLISHED", visibility: "PUBLIC" },
    { id: "00000000-0000-4000-8000-000000000002", title: "Monsoon Letters", author_display_name: "Arjun Rao", description: "A fictional short story about friendship, distance, and return.", language: "hi", status: "PUBLISHED", visibility: "PUBLIC" },
    { id: "00000000-0000-4000-8000-000000000003", title: "Draft at Dawn", author_display_name: "PlayBook Development", description: "Fictional development-only draft.", language: "en", status: "DRAFT", visibility: "PRIVATE" },
    { id: "00000000-0000-4000-8000-000000000004", title: "Review Queue Sample", author_display_name: "PlayBook Development", description: "Fictional development-only review sample.", language: "en", status: "UNDER_REVIEW", visibility: "PRIVATE" },
  ];
  const { error } = await admin.from("catalog_content").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  console.log(JSON.stringify({ event: "development_catalog_seeded", count: rows.length }));
}
seed().catch((error) => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
