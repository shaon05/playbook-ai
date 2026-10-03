export const recommendationWeights = { preference: 5, freshness: 2, exploration: 3 } as const;
export function scoreCatalogItem(input: { genreMatch: boolean; daysSincePublished: number; explorationEligible: boolean }) {
  const freshness = Math.max(0, 1 - input.daysSincePublished / 365);
  return (input.genreMatch ? recommendationWeights.preference : 0) + freshness * recommendationWeights.freshness + (input.explorationEligible ? recommendationWeights.exploration : 0);
}
