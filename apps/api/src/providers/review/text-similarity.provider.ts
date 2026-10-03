export type TextSimilarityResult = "NO_MATCH" | "POSSIBLE_MATCH" | "LIKELY_MATCH" | "UNKNOWN";
export type TextSimilarityResponse = { result: TextSimilarityResult; score?: number; matchedRanges?: { sourceStart: number; sourceEnd: number; candidateStart: number; candidateEnd: number }[]; provider: string; providerVersion: string };

export interface TextSimilarityProvider {
  compare(input: { sourceContentId: string; candidateContentId: string }): Promise<TextSimilarityResponse>;
}

export class UnavailableTextSimilarityProvider implements TextSimilarityProvider {
  async compare(): Promise<TextSimilarityResponse> { return { result: "UNKNOWN", provider: "unavailable", providerVersion: "v1" }; }
}

export class DeterministicTextSimilarityTestProvider implements TextSimilarityProvider {
  constructor(private readonly response: TextSimilarityResponse) {}
  async compare(): Promise<TextSimilarityResponse> { return this.response; }
}

export function createTextSimilarityProvider(): TextSimilarityProvider { return new UnavailableTextSimilarityProvider(); }
