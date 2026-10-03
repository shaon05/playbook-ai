import { describe, expect, it } from "vitest";
import { detectDocumentType, validateDocumentBytes } from "../src/security/document-validator";
import { incidentReference } from "../src/security/enforcement";

describe("upload security validation", () => {
  it("detects supported signatures instead of trusting extensions", async () => {
    expect(detectDocumentType(new TextEncoder().encode("video payload"))).toBe("unsupported");
    expect((await validateDocumentBytes(new TextEncoder().encode("%PDF-1.7"), "application/pdf", 1000)).valid).toBe(true);
    expect((await validateDocumentBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", 1000)).valid).toBe(false);
  });

  it("rejects declared type mismatches and uses safe references", async () => {
    const result = await validateDocumentBytes(new TextEncoder().encode("%PDF-1.7"), "image/png", 1000);
    expect(result.reasonCode).toBe("FILE_TYPE_MISMATCH");
    expect(incidentReference()).toMatch(/^PB-SEC-[A-Z0-9_-]{6}$/);
  });
});
