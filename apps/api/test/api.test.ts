import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadEnv, type ApiEnv } from "../src/config/env";
import type { StorageProvider } from "../src/providers/storage/storage.provider";

const env: ApiEnv = { NODE_ENV: "test", PORT: 3000, HOST: "127.0.0.1", SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "test-key", CORS_ORIGIN: "*", JSON_BODY_LIMIT: "100kb", AWS_REGION: "us-east-1", AWS_S3_BUCKET: "test-bucket", AWS_ACCESS_KEY_ID: "test-access", AWS_SECRET_ACCESS_KEY: "test-secret", MAX_UPLOAD_SIZE_MB: 100, S3_PRESIGNED_URL_EXPIRES_SECONDS: 600 };

function appWithAuth(result: { user?: { id: string; email?: string }; error?: Error }) {
  const fake = {
    auth: { getUser: async () => ({ data: { user: result.user ?? null }, error: result.error ?? null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  } as never;
  return createApp({ env, supabase: fake });
}

function appWithBookServices() {
  let insertedUserId = "";
  const fake = {
    auth: { getUser: async () => ({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null }) },
    from: (table: string) => {
      if (table === "books") return { insert: (values: { user_id: string }) => { insertedUserId = values.user_id; return { select: () => ({ single: async () => ({ data: { id: "00000000-0000-4000-8000-000000000001", user_id: values.user_id, title: "My Book", status: "UPLOAD_PENDING", original_filename: "my-book.pdf", mime_type: "application/pdf", file_size_bytes: 1000 }, error: null }) }) }; } };
      return { insert: async () => ({ error: null }) };
    },
  } as never;
  const storage: StorageProvider = { createUploadUrl: async ({ key, contentType, contentLength }) => ({ bucket: "test-bucket", key, url: "https://s3.example/upload", expiresAt: new Date(Date.now() + 600000).toISOString(), headers: { "Content-Type": contentType, "Content-Length": String(contentLength) } }), getObjectMetadata: async () => null, deleteObject: async () => undefined };
  return { app: createApp({ env, supabase: fake, storage }), getInsertedUserId: () => insertedUserId };
}

describe("API foundation", () => {
  it("returns public health status", async () => {
    const response = await request(createApp({ env })).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ok");
  });

  it("requires authentication for /me", async () => {
    const response = await request(createApp({ env })).get("/api/v1/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed authorization headers", async () => {
    const response = await request(createApp({ env })).get("/api/v1/me").set("Authorization", "Token abc");
    expect(response.status).toBe(401);
  });

  it("accepts a verified user from Supabase", async () => {
    const response = await request(appWithAuth({ user: { id: "user-123", email: "user@example.com" } })).get("/api/v1/me").set("Authorization", "Bearer verified-token");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: "user-123", email: "user@example.com" });
  });

  it("ignores a client-supplied userId and validates environment configuration", async () => {
    const response = await request(appWithAuth({ user: { id: "user-123" } })).get("/api/v1/me?userId=other-user").set("Authorization", "Bearer verified-token");
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("user-123");
    expect(() => loadEnv({ SUPABASE_URL: "not-a-url", SUPABASE_PUBLISHABLE_KEY: "" })).toThrow("Invalid API environment configuration");
  });

  it("rejects unsupported files and oversized uploads before signing", async () => {
    const { app } = appWithBookServices();
    const unsupported = await request(app).post("/api/v1/books").set("Authorization", "Bearer verified-token").send({ originalFilename: "book.epub", mimeType: "application/epub+zip", sizeBytes: 1000 });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe("VALIDATION_ERROR");
    const oversized = await request(app).post("/api/v1/books").set("Authorization", "Bearer verified-token").send({ originalFilename: "book.pdf", mimeType: "application/pdf", sizeBytes: 101 * 1024 * 1024 });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("creates an owned book and returns a short-lived upload URL", async () => {
    const services = appWithBookServices();
    const response = await request(services.app).post("/api/v1/books").set("Authorization", "Bearer verified-token").send({ originalFilename: "book.pdf", mimeType: "application/pdf", sizeBytes: 1000 });
    expect(response.status).toBe(201);
    expect(response.body.data.uploadUrl).toBe("https://s3.example/upload");
    expect(services.getInsertedUserId()).toBe("user-123");
  });
});
