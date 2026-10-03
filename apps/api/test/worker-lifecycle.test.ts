import { describe, expect, it } from "vitest";
import { runWorkerLoop } from "../src/modules/processing/worker-lifecycle";

describe("worker lifecycle", () => {
  it("keeps polling when no job is available and stops on shutdown", async () => {
    const controller = new AbortController();
    let calls = 0;
    const loop = runWorkerLoop({
      runOnce: async () => {
        calls += 1;
        if (calls === 2) controller.abort();
        return false;
      },
      pollIntervalMs: 1,
      signal: controller.signal,
    });
    await loop;
    expect(calls).toBe(2);
  });

  it("survives a polling error and remains available for the next poll", async () => {
    const controller = new AbortController();
    let calls = 0;
    const errors: unknown[] = [];
    await runWorkerLoop({
      runOnce: async () => {
        calls += 1;
        if (calls === 1) throw new Error("temporary database failure");
        controller.abort();
        return false;
      },
      pollIntervalMs: 1,
      signal: controller.signal,
      onError: (error) => errors.push(error),
    });
    expect(calls).toBe(2);
    expect(errors).toHaveLength(1);
  });
});
