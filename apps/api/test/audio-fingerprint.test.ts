import { describe, expect, it } from "vitest";
import { UnavailableAudioFingerprintProvider } from "../src/providers/audio/fingerprint.provider";

describe("audio fingerprint provider boundary", () => {
  it("returns UNKNOWN when no production provider is configured", async () => {
    const provider = new UnavailableAudioFingerprintProvider();
    expect(await provider.fingerprint({ bytes: new Uint8Array([1, 2, 3]) })).toBeNull();
    expect(await provider.compare({ fingerprint: { value: "x", provider: "none", version: "v1" }, candidates: [] })).toBe("UNKNOWN");
  });
});
