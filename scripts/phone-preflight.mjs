import os from "node:os";
import { pathToFileURL } from "node:url";

export function collectLanIpv4(interfaces) {
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address);
}

export function profileProbeUrl(baseUrl) {
  return new URL("/api/v1/profile", baseUrl).toString();
}

export async function probeBackend(baseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(profileProbeUrl(baseUrl), { redirect: "manual" });
  if (response.ok || response.status === 401) return response.status;
  throw new Error(`Backend probe failed with HTTP ${response.status}.`);
}

async function main() {
  const addresses = collectLanIpv4(os.networkInterfaces());
  const requested = process.argv[2];

  if (!requested) {
    if (addresses.length === 0) throw new Error("No external IPv4 address was found.");
    console.log("Candidate iPhone API origins:");
    for (const address of addresses) console.log(`  http://${address}:3000`);
    console.log("Run again with one origin to verify it.");
    return;
  }

  const status = await probeBackend(requested);
  console.log(`Backend reachable at ${requested} (HTTP ${status}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
