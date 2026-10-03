export type ClaimedProcessingJob = { id: string; user_id: string; book_id: string; creator_submission_id: string | null; attempt: number };

export async function claimNextProcessingJob(db: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: ClaimedProcessingJob[] | null; error: { message?: string } | null }> }, jobType: string) {
  const { data, error } = await db.rpc('claim_next_processing_job', { p_job_type: jobType });
  if (error) throw new Error(error.message ?? 'PROCESSING_JOB_CLAIM_FAILED');
  return data?.[0] ?? null;
}
