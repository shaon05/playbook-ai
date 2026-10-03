import { DEFAULT_AI_EARLY_SHARE, DEFAULT_AI_FULL_SHARE, DEFAULT_OWN_AUDIO_SHARE, type EarningShareConfig } from "../../config/revenue";

export type EarningTier = "NOT_EARNING" | "EARLY_EARNING" | "FULL_MONETIZATION";
export type GenerationScope = "PERSONAL_USE" | "CREATOR_COMMERCIAL";
export type GenerationPaymentStatus = "NOT_REQUIRED" | "REQUIRES_PAYMENT" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type GenerationStatus = "NOT_GENERATED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type ContentEarningInput = {
  creatorStatus: "ACTIVE" | "PENDING" | "SUSPENDED" | "NONE";
  monetizationStatus: "NOT_ELIGIBLE" | "ELIGIBLE" | "APPLIED" | "UNDER_REVIEW" | "ENABLED" | "SUSPENDED" | "DISABLED";
  standing: "GOOD_STANDING" | "LIMITED" | "SUSPENDED";
  restricted: boolean;
  published: boolean;
  moderationPassed: boolean;
  rightsDeclared: boolean;
  audioProvenance: "CREATOR_SUPPLIED" | "PLAYBOOK_AI";
  generationScope?: GenerationScope | null;
  generationPaymentStatus?: GenerationPaymentStatus | null;
  generationStatus?: GenerationStatus | null;
};

export type ContentEarning = {
  earningTier: EarningTier;
  creatorShareBps: number | null;
  platformShareBps: number | null;
  earningBlockedReason: string | null;
};

export function resolveContentEarning(input: ContentEarningInput, shares: { ownAudio: EarningShareConfig; aiEarly: EarningShareConfig; aiFull: EarningShareConfig } = { ownAudio: DEFAULT_OWN_AUDIO_SHARE, aiEarly: DEFAULT_AI_EARLY_SHARE, aiFull: DEFAULT_AI_FULL_SHARE }): ContentEarning {
  const blocked = (reason: string): ContentEarning => ({ earningTier: "NOT_EARNING", creatorShareBps: null, platformShareBps: null, earningBlockedReason: reason });
  if (input.creatorStatus !== "ACTIVE") return blocked("CREATOR_NOT_ACTIVE");
  if (input.restricted || input.standing !== "GOOD_STANDING") return blocked("CREATOR_NOT_IN_GOOD_STANDING");
  if (!input.rightsDeclared) return blocked("RIGHTS_DECLARATION_REQUIRED");
  if (!input.published || !input.moderationPassed) return blocked("PUBLICATION_OR_MODERATION_REQUIRED");
  const full = input.monetizationStatus === "ENABLED";
  if (input.audioProvenance === "CREATOR_SUPPLIED") return full ? { earningTier: "FULL_MONETIZATION", creatorShareBps: shares.ownAudio.creatorBps, platformShareBps: shares.ownAudio.platformBps, earningBlockedReason: null } : blocked("FULL_MONETIZATION_REQUIRED");
  if (input.audioProvenance !== "PLAYBOOK_AI") return blocked("AUDIO_PROVENANCE_NOT_ELIGIBLE");
  if (input.generationScope !== "CREATOR_COMMERCIAL") return blocked("COMMERCIAL_GENERATION_REQUIRED");
  if (input.generationPaymentStatus !== "PAID") return blocked("COMMERCIAL_GENERATION_PAYMENT_REQUIRED");
  if (input.generationStatus !== "COMPLETED") return blocked("GENERATION_NOT_COMPLETED");
  return full ? { earningTier: "FULL_MONETIZATION", creatorShareBps: shares.aiFull.creatorBps, platformShareBps: shares.aiFull.platformBps, earningBlockedReason: null } : { earningTier: "EARLY_EARNING", creatorShareBps: shares.aiEarly.creatorBps, platformShareBps: shares.aiEarly.platformBps, earningBlockedReason: null };
}
