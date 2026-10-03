import { cleanupLoadTestBooks, runScenario } from "./runner";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig();
  if (process.argv.includes("--cleanup")) return cleanupLoadTestBooks(config);
  if (config.stages) {
    for (const stage of [{ vus: 10, seconds: 30 }, { vus: 50, seconds: 30 }, { vus: 100, seconds: 60 }, { vus: 250, seconds: 60 }, { vus: 500, seconds: 60 }, { vus: 1000, seconds: 60 }]) {
      if (stage.vus > config.vus) continue;
      await runScenario({ ...config, vus: stage.vus, durationSeconds: stage.seconds });
    }
    return;
  }
  await runScenario(config);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Load test failed."); process.exitCode = 1; });
