import { loadCommandEnv, loadCreatorContext, parseLookupArgs, printStatus } from "./commands";

async function main() {
  const env = loadCommandEnv();
  const lookup = parseLookupArgs(process.argv.slice(2));
  const { user, profile } = await loadCreatorContext(env, lookup);
  printStatus(user, profile);
  if (!user || !profile) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Creator status lookup failed.");
  process.exitCode = 1;
});
