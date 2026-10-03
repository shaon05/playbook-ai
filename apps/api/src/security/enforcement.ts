import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function incidentReference() { return `PB-SEC-${randomBytes(4).toString("base64url").toUpperCase().slice(0, 6)}`; }
export async function recordSecurityEvent(db: SupabaseClient, input: { uploadId: string; userId: string; eventType: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; reasonCode: string; safeSummary: string; detectedFileType?: string; fileSha256?: string; scannerProvider?: string; scannerResultCode?: string }) {
  const reference = incidentReference();
  const { data, error } = await db.from("upload_security_events").insert({ upload_id: input.uploadId, user_id: input.userId, event_type: input.eventType, severity: input.severity, reason_code: input.reasonCode, safe_summary: input.safeSummary, detected_file_type: input.detectedFileType ?? null, file_sha256: input.fileSha256 ?? null, scanner_provider: input.scannerProvider ?? null, scanner_result_code: input.scannerResultCode ?? null, incident_reference: reference }).select("id,incident_reference").single();
  if (error || !data) throw new Error("SECURITY_EVENT_CREATE_FAILED");
  if (input.severity === "HIGH" || input.severity === "CRITICAL") { await db.from("account_restrictions").insert({ user_id: input.userId, restriction_type: "UPLOAD_BLOCKED", reason_code: input.reasonCode, source_security_event_id: data.id }); await db.from("security_audit_log").insert({ user_id: input.userId, security_event_id: data.id, action: "UPLOAD_BLOCKED", actor_type: "AUTOMATION", reason_code: input.reasonCode }); }
  return data.incident_reference as string;
}
