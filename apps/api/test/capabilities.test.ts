import { describe, expect, it } from "vitest";
import { deriveEntitlements } from "../src/modules/users/capabilities";

describe("account capability separation", () => {
  it("does not grant Premium capabilities to an active creator", () => {
    const entitlements = deriveEntitlements({ authenticated: true, plan: "FREE", creatorStatus: "ACTIVE", verificationStatus: "VERIFIED", monetizationStatus: "ENABLED" });
    expect(entitlements.canPublishCreatorContent).toBe(true);
    expect(entitlements.canUsePremiumAudio).toBe(false);
    expect(entitlements.canDownloadOffline).toBe(false);
    expect(entitlements.adsEnabled).toBe(true);
  });

  it("grants Premium capabilities from plan independently of creator state", () => {
    const entitlements = deriveEntitlements({ authenticated: true, plan: "PREMIUM", creatorStatus: "PENDING", verificationStatus: "NOT_APPLIED", monetizationStatus: "NOT_ELIGIBLE" });
    expect(entitlements.canUsePremiumAudio).toBe(true);
    expect(entitlements.canDownloadOffline).toBe(true);
    expect(entitlements.canPublishCreatorContent).toBe(false);
    expect(entitlements.adsEnabled).toBe(false);
  });
});
