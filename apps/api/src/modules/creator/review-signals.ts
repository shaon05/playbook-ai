export type ReviewSignalSource = "DETERMINISTIC" | "TEXT_SIMILARITY" | "AUDIO_FINGERPRINT" | "PROVENANCE" | "AI" | "SECURITY" | "HUMAN";
export type ReviewSignalSeverity = "LOW" | "MEDIUM" | "HIGH";

export async function recordCreatorReviewSignal(
  db: any,
  input: {
    submissionId: string;
    contentId?: string | null;
    signalType: string;
    source: ReviewSignalSource;
    severity: ReviewSignalSeverity;
    confidence?: number | null;
    metadata?: Record<string, unknown>;
    provider?: string | null;
    providerVersion?: string | null;
  },
) {
  const { data: existing } = await db.from("creator_review_signals")
    .select("id")
    .eq("submission_id", input.submissionId)
    .eq("signal_type", input.signalType)
    .eq("status", "OPEN")
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await db.from("creator_review_signals").insert({
    submission_id: input.submissionId,
    content_id: input.contentId ?? null,
    signal_type: input.signalType,
    signal_source: input.source,
    severity: input.severity,
    confidence: input.confidence ?? null,
    metadata_json: input.metadata ?? {},
    provider: input.provider ?? null,
    provider_version: input.providerVersion ?? null,
  }).select("id").single();
  if (error) throw error;
  return data;
}
