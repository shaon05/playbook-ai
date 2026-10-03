import { describe, expect, it, vi } from "vitest";
import { createUploadRateLimitStore, uploadRateLimit } from "../src/middleware/upload-rate-limit";
import type { ApiEnv } from "../src/config/env";

const env = { NODE_ENV: "test", UPLOAD_RATE_LIMIT_PER_HOUR: 1 } as ApiEnv;

describe("upload rate-limit store", () => {
  it("keeps development fallback state outside request handlers", async () => {
    const store = createUploadRateLimitStore(env);
    expect(await store.consume("user-1", 1)).toBe(true);
    expect(await store.consume("user-1", 1)).toBe(false);
  });

  it("uses a shared database RPC in production", async () => {
    const calls: unknown[] = [];
    const store = createUploadRateLimitStore({ ...env, NODE_ENV: "production" }, { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } });
    expect(await store.consume("user-1", 30)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("turns a missing shared rate-limit RPC into a clear service error", async () => {
    const middleware = uploadRateLimit({ ...env, NODE_ENV: "production" }, { consume: async () => { throw new Error("function consume_api_rate_limit does not exist"); } });
    const next = vi.fn();
    await middleware({ auth: { id: "user-1" } } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ code: "UPLOAD_RATE_LIMIT_UNAVAILABLE", statusCode: 503 });
  });
});
