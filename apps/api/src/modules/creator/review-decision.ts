export type ReviewDecision = "PASS" | "REQUIRES_REVIEW" | "BLOCKED";
export type ReviewDecisionInput = { securityBlocked: boolean; rightsDeclared: boolean; moderationBlocked: boolean; unresolvedDuplicate: boolean; similarityResult: "NO_MATCH" | "POSSIBLE_MATCH" | "LIKELY_MATCH" | "UNKNOWN"; personalGenerationMatch: boolean; aiRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" };

export function decideCreatorReview(input: ReviewDecisionInput): ReviewDecision {
  if (input.securityBlocked || input.moderationBlocked) return "BLOCKED";
  if (!input.rightsDeclared) return "REQUIRES_REVIEW";
  if (input.unresolvedDuplicate || input.personalGenerationMatch || input.similarityResult !== "NO_MATCH" || input.aiRisk !== "LOW") return "REQUIRES_REVIEW";
  return "PASS";
}
