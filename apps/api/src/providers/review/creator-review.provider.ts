export type CreatorReviewRisk = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type CreatorReviewAction = "PASS" | "REVIEW";
export type CreatorReviewSignal = { code: string; severity: "LOW" | "MEDIUM" | "HIGH"; confidence: number; explanation: string };
export type CreatorReviewResult = { reviewVersion: string; overallRisk: CreatorReviewRisk; signals: CreatorReviewSignal[]; recommendedAction: CreatorReviewAction; provider: string; providerVersion: string };

export interface CreatorReviewProvider {
  review(input: { title: string; description?: string | null; language?: string | null; textExcerpt?: string | null }): Promise<CreatorReviewResult>;
}

export class UnavailableCreatorReviewProvider implements CreatorReviewProvider {
  async review(): Promise<CreatorReviewResult> { return { reviewVersion: "v1", overallRisk: "UNKNOWN", signals: [], recommendedAction: "REVIEW", provider: "unavailable", providerVersion: "v1" }; }
}

export function createCreatorReviewProvider(): CreatorReviewProvider { return new UnavailableCreatorReviewProvider(); }
