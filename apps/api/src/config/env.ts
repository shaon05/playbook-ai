import { z } from "zod";
import { validateRevenueSharePairs } from "./revenue";

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
  AWS_SESSION_TOKEN: optionalSecret,
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(1024).default(100),
  S3_PRESIGNED_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(900).default(600),
  EXTRACTION_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(3000),
  EXTRACTION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  EXTRACTION_TEMP_DIR: z.string().default(""),
  EXTRACTION_PIPELINE_VERSION: z.string().min(1).default("v1"),
  OCR_PIPELINE_VERSION: z.string().min(1).default("v1"),
  GOOGLE_CLOUD_PROJECT_ID: optionalSecret,
  GOOGLE_CLOUD_LOCATION: z.string().default("us"),
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID: optionalSecret,
  GOOGLE_APPLICATION_CREDENTIALS: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  OPENAI_BOOK_ANALYSIS_MODEL: z.string().default("gpt-4o-mini"),
  BOOK_ANALYSIS_PIPELINE_VERSION: z.string().min(1).default("v1"),
  BOOK_ANALYSIS_PROMPT_VERSION: z.string().min(1).default("v1"),
  DEFAULT_LISTENING_WPM: z.coerce.number().int().positive().default(150),
  DEV_MODERATION_SECRET: optionalSecret,
  DEV_SEED_CATALOG: z.string().default("false"),
  CREATOR_OWN_AUDIO_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(6000),
  PLATFORM_OWN_AUDIO_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(4000),
  AI_EARLY_EARNING_CREATOR_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(6000),
  AI_EARLY_EARNING_PLATFORM_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(4000),
  AI_FULL_MONETIZATION_CREATOR_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(8000),
  AI_FULL_MONETIZATION_PLATFORM_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(2000),
  CREATOR_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(8000),
  PLATFORM_SHARE_BPS: z.coerce.number().int().min(0).max(10000).default(2000),
  MIN_MONETIZATION_FOLLOWERS: z.coerce.number().int().nonnegative().default(1000),
  MIN_MONETIZATION_QUALIFIED_LISTENING_HOURS: z.coerce.number().int().nonnegative().default(500),
  MALWARE_SCANNER_PROVIDER: z.enum(["development", "clamav", "aws"]).optional(),
  MAX_PDF_PAGES: z.coerce.number().int().positive().max(10000).default(500),
  MAX_IMAGE_COUNT: z.coerce.number().int().positive().max(100).default(30),
  MAX_IMAGE_PIXELS: z.coerce.number().int().positive().max(100000000).default(40000000),
  UPLOAD_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().max(10000).default(30),
  QUARANTINE_BUCKET: z.string().min(1).optional(),
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(15000),
  PARSER_TIMEOUT_MS: z.coerce.number().int().positive().max(300000).default(120000),
  OCR_TIMEOUT_MS: z.coerce.number().int().positive().max(600000).default(180000),
  IMAGE_PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().max(300000).default(120000),
  MAX_PROCESSING_RETRIES: z.coerce.number().int().min(1).max(5).default(3),
  QUARANTINE_REJECTED_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(7),
  QUARANTINE_MALICIOUS_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(30),
  QUARANTINE_ABANDONED_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(2),
  SECURITY_E2E_POLL_INTERVAL_MS: z.coerce.number().int().positive().max(60000).default(5000),
  SECURITY_E2E_TIMEOUT_MS: z.coerce.number().int().positive().max(900000).default(180000),
});

export type ApiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, unknown> = process.env): ApiEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue: z.ZodIssue) => issue.path.join(".") || "environment").join(", ");
    throw new Error(`Invalid API environment configuration. Check: ${fields}`);
  }
  validateRevenueSharePairs([
    { creatorBps: result.data.CREATOR_OWN_AUDIO_SHARE_BPS, platformBps: result.data.PLATFORM_OWN_AUDIO_SHARE_BPS },
    { creatorBps: result.data.AI_EARLY_EARNING_CREATOR_SHARE_BPS, platformBps: result.data.AI_EARLY_EARNING_PLATFORM_SHARE_BPS },
    { creatorBps: result.data.AI_FULL_MONETIZATION_CREATOR_SHARE_BPS, platformBps: result.data.AI_FULL_MONETIZATION_PLATFORM_SHARE_BPS },
    { creatorBps: result.data.CREATOR_SHARE_BPS, platformBps: result.data.PLATFORM_SHARE_BPS },
  ]);
  return result.data;
}
