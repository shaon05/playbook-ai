import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().default("*"),
  JSON_BODY_LIMIT: z.string().default("100kb"),
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: optionalSecret,
  AWS_SECRET_ACCESS_KEY: optionalSecret,
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(1024).default(100),
  S3_PRESIGNED_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  EXTRACTION_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(3000),
  EXTRACTION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  EXTRACTION_TEMP_DIR: z.string().default(""),
  EXTRACTION_PIPELINE_VERSION: z.string().min(1).default("v1"),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, unknown> = process.env): ApiEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue: z.ZodIssue) => issue.path.join(".") || "environment").join(", ");
    throw new Error(`Invalid API environment configuration. Check: ${fields}`);
  }
  return result.data;
}
