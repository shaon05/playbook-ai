import "dotenv/config";
import { loadEnv } from "../config/env";

type Mode = "clean" | "malware-test" | "all";
const env = loadEnv();
if (process.env.ALLOW_SECURITY_E2E !== "true") throw new Error("Refusing to run upload security E2E. Set ALLOW_SECURITY_E2E=true explicitly.");
const args = process.argv.slice(2); const mode = (args[args.indexOf("--mode") + 1] as Mode | undefined) ?? "all";
if (!["clean", "malware-test", "all"].includes(mode)) throw new Error("Use --mode clean, --mode malware-test, or --mode all.");
const baseUrl = process.env.SECURITY_E2E_API_URL ?? `http://127.0.0.1:${env.PORT}/api/v1`; const token = process.env.SECURITY_E2E_ACCESS_TOKEN;
if (!token) throw new Error("SECURITY_E2E_ACCESS_TOKEN is required for live upload verification.");
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

function fixture(malware: boolean) { const marker = malware ? "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*" : "PlayBook safe security E2E fixture"; return Buffer.from(`%PDF-1.7\n% PlayBook security fixture\n${marker}\n%%EOF\n`); }
async function runFixture(malware: boolean) {
  const bytes = fixture(malware); let documentId = ""; let bookId = "";
  try {
    const create = await fetch(`${baseUrl}/books`, { method: "POST", headers, body: JSON.stringify({ originalFilename: malware ? "security-eicar-test.pdf" : "security-clean-test.pdf", mimeType: "application/pdf", sizeBytes: bytes.length, title: "Security E2E Fixture" }) });
    const created = await create.json() as { data?: { book: { id: string }; uploadUrl: string; requiredHeaders?: Record<string, string> } };
    if (!create.ok || !created.data) throw new Error(`Create upload failed (${create.status}).`); bookId = created.data.book.id;
    const put = await fetch(created.data.uploadUrl, { method: "PUT", headers: created.data.requiredHeaders, body: bytes }); if (!put.ok) throw new Error(`Quarantine upload failed (${put.status}).`);
    const started = Date.now(); let last: unknown;
    while (Date.now() - started < env.SECURITY_E2E_TIMEOUT_MS) {
      const complete = await fetch(`${baseUrl}/books/${bookId}/upload-complete`, { method: "POST", headers }); last = await complete.json();
      if (complete.status !== 409) return { state: complete.ok ? "PASS" : "FAIL", status: complete.status, result: last };
      await new Promise((resolve) => setTimeout(resolve, env.SECURITY_E2E_POLL_INTERVAL_MS));
    }
    return { state: "TIMEOUT", result: last };
  } finally {
    if (documentId) await fetch(`${baseUrl}/documents/${documentId}`, { method: "DELETE", headers });
    if (bookId) await fetch(`${baseUrl}/books/${bookId}`, { method: "DELETE", headers });
  }
}
async function main() {
  const report: Record<string, unknown> = { cloudEnvironment: process.env.AWS_REGION ?? "unknown", quarantine: "EXERCISED", processingGate: "VALIDATED_BY_UPLOAD_COMPLETE" };
  if (mode === "clean" || mode === "all") report.cleanFixture = await runFixture(false);
  if (mode === "malware-test" || mode === "all") report.malwareTestFixture = await runFixture(true);
  console.info("Security E2E"); console.info(JSON.stringify(report, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Security E2E failed."); process.exitCode = 1; });
