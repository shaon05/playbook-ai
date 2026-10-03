import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env"), override: false });

export type Scenario = "health" | "auth" | "library" | "catalog" | "upload-auth" | "upload-complete" | "rate-limit";

export type LoadTestConfig = {
  baseUrl: string;
  scenario: Scenario;
  vus: number;
  durationSeconds: number;
  requests: number;
  authToken?: string;
  bookId?: string;
  allowMutations: boolean;
  allowRateLimit: boolean;
  allowProduction: boolean;
  stages: boolean;
  diagnosticP95Ms: number;
  diagnosticP99Ms: number;
  diagnosticMaxErrorRate: number;
};

const scenarios = new Set<Scenario>(["health", "auth", "library", "catalog", "upload-auth", "upload-complete", "rate-limit"]);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function boolean(value: string | undefined) {
  return value === "true" || value === "1";
}

function positiveInt(value: string | undefined, fallback: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function assertSafeTarget(baseUrl: string, allowProduction: boolean) {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error("LOAD_TEST_BASE_URL must be a valid URL."); }
  const host = url.hostname.toLowerCase();
  const productionLooking = host.includes("playbook.ai") || host.includes("playbook-ai.com") || host.includes("production") || host === "api.playbook-ai.com";
  if (productionLooking && !allowProduction) throw new Error("Refusing to load-test a production-looking URL. Use a local/staging URL or set LOAD_TEST_ALLOW_PRODUCTION=true plus LOAD_TEST_PRODUCTION_CONFIRMATION=I_UNDERSTAND.");
  if (allowProduction && process.env.LOAD_TEST_PRODUCTION_CONFIRMATION !== "I_UNDERSTAND") throw new Error("Production override requires LOAD_TEST_PRODUCTION_CONFIRMATION=I_UNDERSTAND.");
}

export function loadConfig(): LoadTestConfig {
  const baseUrl = (process.env.LOAD_TEST_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("LOAD_TEST_BASE_URL is required. Example: http://127.0.0.1:3000");
  const allowProduction = boolean(process.env.LOAD_TEST_ALLOW_PRODUCTION);
  assertSafeTarget(baseUrl, allowProduction);
  const scenario = (argument("--scenario") ?? process.env.LOAD_TEST_SCENARIO ?? "health") as Scenario;
  if (!scenarios.has(scenario)) throw new Error(`Unsupported scenario: ${scenario}`);
  const vus = positiveInt(argument("--vus") ?? process.env.LOAD_TEST_VUS, 10, "VUs");
  if (vus > 1000 && !boolean(process.env.LOAD_TEST_ALLOW_HIGHER)) throw new Error("VUs above 1000 require LOAD_TEST_ALLOW_HIGHER=true.");
  const config: LoadTestConfig = {
    baseUrl,
    scenario,
    vus,
    durationSeconds: positiveInt(argument("--duration") ?? process.env.LOAD_TEST_DURATION_SECONDS, 10, "Duration"),
    requests: positiveInt(argument("--requests") ?? process.env.LOAD_TEST_REQUESTS, 10, "Requests"),
    authToken: process.env.LOAD_TEST_AUTH_TOKEN?.trim() || undefined,
    bookId: process.env.LOAD_TEST_BOOK_ID?.trim() || undefined,
    allowMutations: boolean(process.env.LOAD_TEST_ALLOW_MUTATIONS),
    allowRateLimit: boolean(process.env.LOAD_TEST_ALLOW_RATE_LIMIT_TEST),
    allowProduction,
    stages: process.argv.includes("--stages") || boolean(process.env.LOAD_TEST_STAGES),
    diagnosticP95Ms: Number(process.env.LOAD_TEST_DIAGNOSTIC_P95_MS ?? 1000),
    diagnosticP99Ms: Number(process.env.LOAD_TEST_DIAGNOSTIC_P99_MS ?? 2000),
    diagnosticMaxErrorRate: Number(process.env.LOAD_TEST_DIAGNOSTIC_MAX_ERROR_RATE ?? 0.05),
  };
  if (config.scenario !== "health" && !config.authToken) throw new Error(`LOAD_TEST_AUTH_TOKEN is required for the ${config.scenario} scenario.`);
  if (["upload-auth", "upload-complete"].includes(config.scenario) && !config.allowMutations) throw new Error("Mutation scenarios require LOAD_TEST_ALLOW_MUTATIONS=true and a dedicated load-test account.");
  if (config.scenario === "upload-complete" && !config.bookId) throw new Error("LOAD_TEST_BOOK_ID is required for upload-complete.");
  if (config.scenario === "rate-limit" && !config.allowRateLimit) throw new Error("Rate-limit testing requires LOAD_TEST_ALLOW_RATE_LIMIT_TEST=true.");
  if (!Number.isFinite(config.diagnosticP95Ms) || !Number.isFinite(config.diagnosticP99Ms) || config.diagnosticMaxErrorRate < 0 || config.diagnosticMaxErrorRate > 1) throw new Error("Diagnostic thresholds are invalid.");
  return config;
}
