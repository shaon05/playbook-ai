import { describe, expect, it } from "vitest";
import { decideCreatorReview } from "../src/modules/creator/review-decision";
import { UnavailableTextSimilarityProvider } from "../src/providers/review/text-similarity.provider";
import { UnavailableCreatorReviewProvider } from "../src/providers/review/creator-review.provider";

const clean = { securityBlocked: false, rightsDeclared: true, moderationBlocked: false, unresolvedDuplicate: false, similarityResult: "NO_MATCH" as const, personalGenerationMatch: false, aiRisk: "LOW" as const };
describe("creator content review decision", () => {
  it("passes a clean rights-declared submission", () => expect(decideCreatorReview(clean)).toBe("PASS"));
  it("routes cross-content and personal-generation signals to review", () => { expect(decideCreatorReview({ ...clean, unresolvedDuplicate: true })).toBe("REQUIRES_REVIEW"); expect(decideCreatorReview({ ...clean, personalGenerationMatch: true })).toBe("REQUIRES_REVIEW"); });
  it("blocks security and moderation decisions only", () => expect(decideCreatorReview({ ...clean, securityBlocked: true })).toBe("BLOCKED"));
  it("uses safe UNKNOWN fallbacks", async () => { expect((await new UnavailableTextSimilarityProvider().compare({ sourceContentId: "a", candidateContentId: "b" })).result).toBe("UNKNOWN"); expect((await new UnavailableCreatorReviewProvider().review({ title: "x" })).recommendedAction).toBe("REVIEW"); });
  it("does not interpret an AI infringement phrase as a legal decision", () => expect(decideCreatorReview({ ...clean, aiRisk: "HIGH" })).toBe("REQUIRES_REVIEW"));
});
