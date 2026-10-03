export type SubscriptionPlan = "FREE" | "PREMIUM";
export type CreatorStatus = "NONE" | "PENDING" | "ACTIVE" | "SUSPENDED";
export type VerificationStatus = "NOT_APPLIED" | "APPLIED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "REVOKED";
export type MonetizationStatus = "NOT_ELIGIBLE" | "ELIGIBLE" | "APPLIED" | "UNDER_REVIEW" | "ENABLED" | "SUSPENDED" | "DISABLED";

export function deriveEntitlements(input: { authenticated: boolean; plan: SubscriptionPlan; creatorStatus: CreatorStatus; verificationStatus?: VerificationStatus; monetizationStatus?: MonetizationStatus }) {
  const { authenticated, plan, creatorStatus } = input;
  return {
    canUploadPrivateDocuments: authenticated,
    canFavorite: authenticated,
    canSyncProgress: authenticated,
    canCreateCreatorProfile: authenticated && creatorStatus === "NONE",
    canUsePremiumAudio: authenticated && plan === "PREMIUM",
    canPublishCreatorContent: authenticated && creatorStatus === "ACTIVE",
    canViewCreatorAnalytics: authenticated && creatorStatus === "ACTIVE",
    adsEnabled: !authenticated || plan !== "PREMIUM",
    canDownloadOffline: authenticated && plan === "PREMIUM",
  };
}
