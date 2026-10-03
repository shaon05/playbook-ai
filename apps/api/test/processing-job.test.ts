import { describe, expect, it } from "vitest";
import { claimNextProcessingJob } from "../src/modules/processing/job-claim";

describe("shared processing job claim", () => {
  it("allows only one worker to claim a queued job", async () => {
    let available = true;
    const db = { rpc: async () => { if (!available) return { data: [], error: null }; available = false; return { data: [{ id: "job-1", user_id: "user-1", book_id: "book-1", creator_submission_id: null, attempt: 1 }], error: null }; } };
    const [first, second] = await Promise.all([claimNextProcessingJob(db, "DOCUMENT_EXTRACTION"), claimNextProcessingJob(db, "DOCUMENT_EXTRACTION")]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it("surfaces claim failures so a worker does not process without a claim", async () => {
    const db = { rpc: async () => ({ data: null, error: { message: "database unavailable" } }) };
    await expect(claimNextProcessingJob(db, "DOCUMENT_EXTRACTION")).rejects.toThrow("database unavailable");
  });
});
