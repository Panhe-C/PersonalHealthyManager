import { prisma } from "@/src/db/client";
import { runAutomationCycle } from "@/src/services/automationService";

const watch = process.argv.includes("--watch");
const intervalMs = Math.max(60_000, Number(process.env.HBM_AUTOMATION_INTERVAL_MS || 15 * 60 * 1000));

async function run() {
  const results = await runAutomationCycle();
  console.log(`[automation] ${new Date().toISOString()} ${JSON.stringify(results)}`);
}

async function main() {
  await run();
  if (!watch) return;
  setInterval(() => void run().catch((error) => console.error("[automation]", error)), intervalMs);
}

main().then(async () => { if (!watch) await prisma.$disconnect(); }).catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
