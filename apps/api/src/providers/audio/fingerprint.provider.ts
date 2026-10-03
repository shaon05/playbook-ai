export type AudioFingerprintResult = "NO_MATCH" | "LIKELY_MATCH" | "UNKNOWN";
export type AudioFingerprint = { value: string; provider: string; version: string };

export interface AudioFingerprintProvider {
  fingerprint(input: { bytes: Uint8Array; mimeType?: string }): Promise<AudioFingerprint | null>;
  compare(input: { fingerprint: AudioFingerprint; candidates: AudioFingerprint[] }): Promise<AudioFingerprintResult>;
}

export function createAudioFingerprintProvider(): AudioFingerprintProvider {
  return new UnavailableAudioFingerprintProvider();
}

/** Safe default until a real perceptual fingerprint provider is approved. */
export class UnavailableAudioFingerprintProvider implements AudioFingerprintProvider {
  async fingerprint(): Promise<AudioFingerprint | null> { return null; }
  async compare(): Promise<AudioFingerprintResult> { return "UNKNOWN"; }
}
