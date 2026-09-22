#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BACKUP_LABEL, createBackupLaunchAgent } from "./backup-launchd-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchAgentsDirectory = path.join(os.homedir(), "Library", "LaunchAgents");
const logDirectory = path.join(os.homedir(), "Library", "Logs", "HealthyBodyManager");
const plistPath = path.join(launchAgentsDirectory, `${BACKUP_LABEL}.plist`);
const serviceTarget = `gui/${process.getuid()}/${BACKUP_LABEL}`;
const command = process.argv[2] || "status";
const intervalSeconds = Number(process.env.HBM_BACKUP_INTERVAL_SECONDS || 86_400);

function launchctl(args, options = {}) {
  return execFileSync("launchctl", args, { encoding: "utf8", stdio: options.inherit ? "inherit" : "pipe" });
}

if (command === "install") {
  mkdirSync(launchAgentsDirectory, { recursive: true });
  mkdirSync(logDirectory, { recursive: true });
  const temporaryPath = `${plistPath}.tmp`;
  writeFileSync(
    temporaryPath,
    createBackupLaunchAgent({
      projectRoot,
      nodePath: process.execPath,
      logDirectory,
      intervalSeconds: Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 86_400
    }),
    { mode: 0o600 }
  );
  renameSync(temporaryPath, plistPath);
  try {
    launchctl(["bootout", serviceTarget]);
  } catch {}
  launchctl(["bootstrap", `gui/${process.getuid()}`, plistPath], { inherit: true });
  launchctl(["kickstart", "-k", serviceTarget], { inherit: true });
  console.log(`Installed and started ${BACKUP_LABEL}`);
} else if (command === "uninstall") {
  try {
    launchctl(["bootout", serviceTarget], { inherit: true });
  } catch {}
  rmSync(plistPath, { force: true });
  console.log(`Uninstalled ${BACKUP_LABEL}`);
} else if (command === "status") {
  try {
    process.stdout.write(launchctl(["print", serviceTarget]));
  } catch {
    console.log(`${BACKUP_LABEL} is not installed or running.`);
    process.exitCode = 1;
  }
} else {
  console.error("Usage: npm run backup:service -- install|uninstall|status");
  process.exitCode = 2;
}
