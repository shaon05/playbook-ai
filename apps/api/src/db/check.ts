import "dotenv/config";
import { loadEnv } from "../config/env";
import { createSupabaseAdminClient } from "../lib/supabase-admin";

const env = loadEnv();
const required = ["profiles", "books", "book_files", "processing_jobs", "genres", "catalog_content", "creator_profiles", "creator_submissions", "document_uploads", "document_pages", "upload_security_events", "account_restrictions", "creator_verifications", "creator_guideline_acceptances", "creator_monetization_applications", "creator_duplicate_flags"];
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error(JSON.stringify({ status: "NOT_CONFIGURED", missing: "SUPABASE_SERVICE_ROLE_KEY" })); process.exit(2); }
async function main() {
  const client = createSupabaseAdminClient(env);
  const results = await Promise.all(required.map(async (table) => { const { error } = await client.from(table).select("*").limit(1); return { table, status: error ? "FAIL" : "OK", ...(error ? { code: error.code, message: error.message } : {}) }; }));
  console.log(JSON.stringify({ status: results.every((result) => result.status === "OK") ? "READY" : "NOT_READY", tables: results }, null, 2));
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}
void main();
