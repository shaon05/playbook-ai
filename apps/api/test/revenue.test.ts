import { describe, expect, it } from "vitest";
import { validateFutureRevenueShare } from "../src/config/revenue";

describe("future revenue configuration", () => {
  it("accepts the configured 80/20 basis-point split", () => {
    expect(validateFutureRevenueShare({ creatorBps: 8000, platformBps: 2000 })).toEqual({ creatorBps: 8000, platformBps: 2000 });
  });

  it("rejects a split that does not total 10000 basis points", () => {
    expect(() => validateFutureRevenueShare({ creatorBps: 8000, platformBps: 1000 })).toThrow();
  });
});
