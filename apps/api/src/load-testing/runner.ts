import { appendFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { LoadTestConfig } from "./config";

type RequestResult = { durationMs: number; status: number; networkError: boolean };
type Report = { total: number; successes: number; errors: number; requestsPerSecond: number; p50: number; p95: number; p99: number; status: Map<number, number>; networkErrors: number };

const stateFile = path.resolve(process.cwd(), "apps/api/.load-test-state.jsonl");

function endpoint(config: LoadTestConfig, route: string) { return `${config.baseUrl}/api/v1${route}`; }

async function request(config: LoadTestConfig, route: string, init: RequestInit = {}): Promise<RequestResult & { body?: unknown }> {
  const headers = new Headers(init.headers);
  if (config.authToken) headers.set("Authorization", `Bearer ${config.authToken}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const started = performance.now();
  try {
    const response = await fetch(endpoint(config, route), { ...init, headers, signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
    return { durationMs: performance.now() - started, status: response.status, networkError: false, body };
  } catch {
    return { durationMs: performance.now() - started, status: 0, networkError: true };
  }
}

async function recordBook(body: unknown) {
  const candidate = body as { data?: { book?: { id?: string } } } | undefined;
  const id = candidate?.data?.book?.id;
  if (typeof id === "string") await appendFile(stateFile, `${JSON.stringify({ bookId: id, createdAt: new Date().toISOString() })}\n`, "utf8");
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil((percentileValue / 100) * values.length) - 1);
  return Math.round(values.sort((a, b) => a - b)[index]);
}

async function runRequests(config: LoadTestConfig, route: (iteration: number) => string, init: RequestInit | ((iteration: number) => RequestInit) = {}) {
  const results: RequestResult[] = [];
  const deadline = Date.now() + config.durationSeconds * 1000;
  let sequence = 0;
  const worker = async () => {
    while (Date.now() < deadline) {
      const iteration = sequence++;
      const result = await request(config, route(iteration), typeof init === "function" ? init(iteration) : init);
      results.push(result);
    }
  };
  await Promise.all(Array.from({ length: config.vus }, worker));
  return results;
}

async function runFixedRequests(config: LoadTestConfig, route: (iteration: number) => string, init: RequestInit | ((iteration: number) => RequestInit) = {}) {
  const results: RequestResult[] = [];
  let sequence = 0;
  const worker = async () => {
    while (true) {
      const iteration = sequence++;
      if (iteration >= config.requests) return;
      const result = await request(config, route(iteration), typeof init === "function" ? init(iteration) : init);
      results.push(result);
      if (config.scenario === "upload-auth") await recordBook((result as RequestResult & { body?: unknown }).body);
    }
  };
  await Promise.all(Array.from({ length: Math.min(config.vus, config.requests) }, worker));
  return results;
}

function report(results: RequestResult[], elapsedMs: number, config: LoadTestConfig): Report {
  const status = new Map<number, number>();
  for (const result of results) status.set(result.status, (status.get(result.status) ?? 0) + 1);
  const durations = results.map((result) => result.durationMs);
  const errors = results.filter((result) => result.networkError || result.status < 200 || result.status >= 400).length;
  return { total: results.length, successes: results.length - errors, errors, requestsPerSecond: results.length / Math.max(elapsedMs / 1000, 0.001), p50: percentile(durations, 50), p95: percentile(durations, 95), p99: percentile(durations, 99), status, networkErrors: results.filter((result) => result.networkError).length };
}

export async function runScenario(config: LoadTestConfig) {
  const started = performance.now();
  let results: RequestResult[];
  if (config.scenario === "health") results = await runRequests(config, () => "/health");
  else if (config.scenario === "auth") results = await runRequests(config, () => "/me");
  else if (config.scenario === "library") results = await runRequests(config, () => "/books");
  else if (config.scenario === "catalog") results = await runRequests(config, (iteration) => ["/catalog/genres", "/catalog/recommendations?limit=20", "/search?q=book&limit=20"][iteration % 3]);
  else if (config.scenario === "upload-auth" || config.scenario === "rate-limit") results = await runFixedRequests(config, () => "/books", { method: "POST", body: JSON.stringify({ originalFilename: `load-test-${Date.now()}.pdf`, mimeType: "application/pdf", sizeBytes: 1024, title: "Load Test Fixture" }) });
  else results = await runFixedRequests(config, () => `/books/${config.bookId}/upload-complete`, { method: "POST", body: JSON.stringify({}) });
  const output = report(results, performance.now() - started, config);
  const rateLimited = output.status.get(429) ?? 0;
  const serverErrors = [...output.status.entries()].filter(([status]) => status >= 500).reduce((sum, [, count]) => sum + count, 0);
  const errorRate = output.total ? output.errors / output.total : 0;
  const bottleneck = rateLimited ? "Rate Limit" : serverErrors ? "API / DB" : output.p95 > config.diagnosticP95Ms || output.p99 > config.diagnosticP99Ms ? "API / DB / Unknown" : "Unknown";
  console.log(JSON.stringify({ scenario: config.scenario, concurrency: config.vus, durationSeconds: config.durationSeconds, totalRequests: output.total, requestsPerSecond: Number(output.requestsPerSecond.toFixed(2)), p50Ms: output.p50, p95Ms: output.p95, p99Ms: output.p99, successRate: output.total ? Number((output.successes / output.total).toFixed(4)) : 0, errorRate: Number(errorRate.toFixed(4)), statusDistribution: Object.fromEntries(output.status), networkErrors: output.networkErrors, rateLimited429: rateLimited, serverErrors5xx: serverErrors, diagnosticThresholds: { p95Ms: config.diagnosticP95Ms, p99Ms: config.diagnosticP99Ms, maxErrorRate: config.diagnosticMaxErrorRate }, diagnosticPass: errorRate <= config.diagnosticMaxErrorRate && output.p95 <= config.diagnosticP95Ms && output.p99 <= config.diagnosticP99Ms, bottleneckObserved: bottleneck }, null, 2));
  return output;
}

export async function cleanupLoadTestBooks(config: LoadTestConfig) {
  let contents = "";
  try { contents = await readFile(stateFile, "utf8"); } catch { console.log("No load-test state file found; nothing to clean."); return; }
  const ids = contents.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as { bookId?: string }).map((item) => item.bookId).filter((id): id is string => Boolean(id));
  if (!config.authToken) throw new Error("LOAD_TEST_AUTH_TOKEN is required for cleanup.");
  let deleted = 0;
  for (const id of ids) { const result = await request(config, `/books/${id}`, { method: "DELETE" }); if (result.status === 204 || result.status === 200) deleted++; }
  await rm(stateFile, { force: true });
  console.log(`Cleaned up ${deleted} load-test book(s) created by this suite; ${ids.length - deleted} could not be deleted.`);
}
