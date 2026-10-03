import { describe, expect, it } from "vitest";
import { resolveContentEarning } from "../src/modules/creator/earning";

const base = { creatorStatus: "ACTIVE" as const, monetizationStatus: "NOT_ELIGIBLE" as const, standing: "GOOD_STANDING" as const, restricted: false, published: true, moderationPassed: true, rightsDeclared: true };

describe("content earning model", () => {
  it("does not earn from creator-supplied audio before full monetization", () => expect(resolveContentEarning({ ...base, audioProvenance: "CREATOR_SUPPLIED" }).earningTier).toBe("NOT_EARNING"));
  it("uses 60/40 for creator audio after full monetization", () => expect(resolveContentEarning({ ...base, monetizationStatus: "ENABLED", audioProvenance: "CREATOR_SUPPLIED" })).toMatchObject({ earningTier: "FULL_MONETIZATION", creatorShareBps: 6000, platformShareBps: 4000 }));
  it("allows paid commercial AI audio to earn early", () => expect(resolveContentEarning({ ...base, audioProvenance: "PLAYBOOK_AI", generationScope: "CREATOR_COMMERCIAL", generationPaymentStatus: "PAID", generationStatus: "COMPLETED" })).toMatchObject({ earningTier: "EARLY_EARNING", creatorShareBps: 6000, platformShareBps: 4000 }));
  it("upgrades only future commercial AI earning terms when fully enabled", () => expect(resolveContentEarning({ ...base, monetizationStatus: "ENABLED", audioProvenance: "PLAYBOOK_AI", generationScope: "CREATOR_COMMERCIAL", generationPaymentStatus: "PAID", generationStatus: "COMPLETED" })).toMatchObject({ earningTier: "FULL_MONETIZATION", creatorShareBps: 8000, platformShareBps: 2000 }));
  it("blocks unpaid and personal-use generation even for Premium-like independent states", () => {
    expect(resolveContentEarning({ ...base, audioProvenance: "PLAYBOOK_AI", generationScope: "CREATOR_COMMERCIAL", generationPaymentStatus: "REQUIRES_PAYMENT", generationStatus: "COMPLETED" }).earningTier).toBe("NOT_EARNING");
    expect(resolveContentEarning({ ...base, audioProvenance: "PLAYBOOK_AI", generationScope: "PERSONAL_USE", generationPaymentStatus: "PAID", generationStatus: "COMPLETED" }).earningTier).toBe("NOT_EARNING");
  });
  it("requires exact integer-hour thresholds outside the resolver", () => expect(500 * 60 * 60).toBe(1800000));
});
